/**
 * Distributed abuse guards for expensive Next.js routes.
 *
 *  - consumeRateLimit: fixed-window per-user limits. Unlike src/lib/rate-limit.ts
 *    (per-instance memory), this holds across every Vercel instance.
 *  - acquire/releaseBrowserLease: a global cap on concurrent headless Chromium
 *    sessions (Canvas SSO + browse). Leases carry an expiry so a crashed
 *    instance that never releases can't wedge the cap.
 *
 * All public functions here are gated by CONVEX_INTERNAL_SECRET — callers are
 * Next.js route handlers that have already authenticated the user with Clerk.
 */

import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { assertInternalSecret } from "./internalSecret.helpers";

// ---------------------------------------------------------------------------
// Rate limits — limits live server-side so callers can only pick a bucket.
// ---------------------------------------------------------------------------

const RATE_LIMITS = {
  canvasStream: { limit: 10, windowMs: 60_000 },
  canvasInput: { limit: 60, windowMs: 60_000 },
  browse: { limit: 10, windowMs: 60_000 },
  calendarSync: { limit: 6, windowMs: 60_000 },
  slugSchedule: { limit: 6, windowMs: 60_000 },
  // Public Convex actions that hit Canvas with the user's cookies.
  canvasSync: { limit: 4, windowMs: 60_000 },
  officeHours: { limit: 20, windowMs: 60_000 },
} as const;

type RateLimitBucket = keyof typeof RATE_LIMITS;

const rateLimitBucket = v.union(
  v.literal("canvasStream"),
  v.literal("canvasInput"),
  v.literal("browse"),
  v.literal("calendarSync"),
  v.literal("slugSchedule"),
  v.literal("canvasSync"),
  v.literal("officeHours")
);

type RateLimitResult = { ok: boolean; retryAfterMs: number };

async function consumeBucket(
  ctx: MutationCtx,
  bucket: RateLimitBucket,
  clerkId: string
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `${bucket}:${clerkId}`;
  const now = Date.now();

  const existing = await ctx.db
    .query("rateLimitBuckets")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!existing || now - existing.windowStart >= windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("rateLimitBuckets", { key, windowStart: now, count: 1 });
    }
    return { ok: true, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.windowStart + windowMs - now };
  }
  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return { ok: true, retryAfterMs: 0 };
}

export const consumeRateLimit = mutation({
  args: { secret: v.string(), bucket: rateLimitBucket, clerkId: v.string() },
  handler: async (ctx, args): Promise<RateLimitResult> => {
    assertInternalSecret(args.secret);
    return consumeBucket(ctx, args.bucket, args.clerkId);
  },
});

/** Same limits for public Convex actions, keyed by the caller's Clerk subject. */
export const consumeRateLimitInternal = internalMutation({
  args: { bucket: rateLimitBucket, clerkId: v.string() },
  handler: async (ctx, args): Promise<RateLimitResult> =>
    consumeBucket(ctx, args.bucket, args.clerkId),
});

// ---------------------------------------------------------------------------
// Browser leases — global concurrency cap for headless Chromium
// ---------------------------------------------------------------------------

/** Max concurrent Chromium sessions across all instances and users. */
const MAX_CONCURRENT_BROWSERS = 8;
/** Per-kind ceilings so chat browse bursts can't starve Canvas login (or vice versa). */
const MAX_BROWSERS_BY_KIND = { canvasSso: 5, browse: 5 } as const;
/** One user can't hold the whole pool. */
const MAX_BROWSERS_PER_OWNER = 2;

export const acquireBrowserLease = mutation({
  args: {
    secret: v.string(),
    kind: v.union(v.literal("canvasSso"), v.literal("browse")),
    owner: v.string(),
    ttlMs: v.number(),
  },
  handler: async (ctx, args): Promise<{ leaseId: Id<"browserLeases"> | null }> => {
    assertInternalSecret(args.secret);
    const now = Date.now();
    // Clamp so a caller can't park a lease forever (Vercel maxDuration is 300 s).
    const ttlMs = Math.min(Math.max(args.ttlMs, 5_000), 310_000);

    const active = await ctx.db
      .query("browserLeases")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", now))
      .take(MAX_CONCURRENT_BROWSERS + 1);

    if (active.length >= MAX_CONCURRENT_BROWSERS) return { leaseId: null };
    if (active.filter((l) => l.kind === args.kind).length >= MAX_BROWSERS_BY_KIND[args.kind]) {
      return { leaseId: null };
    }
    if (active.filter((l) => l.owner === args.owner).length >= MAX_BROWSERS_PER_OWNER) {
      return { leaseId: null };
    }

    const leaseId = await ctx.db.insert("browserLeases", {
      owner: args.owner,
      kind: args.kind,
      expiresAt: now + ttlMs,
    });
    return { leaseId };
  },
});

export const releaseBrowserLease = mutation({
  args: { secret: v.string(), leaseId: v.id("browserLeases") },
  handler: async (ctx, args): Promise<void> => {
    assertInternalSecret(args.secret);
    const lease = await ctx.db.get(args.leaseId);
    if (lease) await ctx.db.delete(lease._id);
  },
});

// ---------------------------------------------------------------------------
// Cron: prune expired leases and stale rate-limit windows (bounded per run)
// ---------------------------------------------------------------------------

const PRUNE_BATCH = 500;
const RATE_LIMIT_ROW_TTL_MS = 60 * 60_000;

export const pruneExpired = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const now = Date.now();
    const leases = await ctx.db
      .query("browserLeases")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(PRUNE_BATCH);
    for (const lease of leases) await ctx.db.delete(lease._id);

    const buckets = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_windowStart", (q) => q.lt("windowStart", now - RATE_LIMIT_ROW_TTL_MS))
      .take(PRUNE_BATCH);
    for (const bucket of buckets) await ctx.db.delete(bucket._id);

    const inputs = await ctx.db
      .query("ssoInputs")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(PRUNE_BATCH);
    for (const input of inputs) await ctx.db.delete(input._id);

    const sessions = await ctx.db
      .query("ssoSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(PRUNE_BATCH);
    for (const session of sessions) await ctx.db.delete(session._id);
  },
});
