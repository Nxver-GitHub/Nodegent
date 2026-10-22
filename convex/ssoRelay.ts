/**
 * Cross-instance relay for Canvas SSO viewer input (US-2.2).
 *
 * The SSE stream that owns the headless browser and the click/type/pause POSTs
 * can land on different Vercel instances. Each stream registers a fresh
 * sessionId (`beginSession`); input routes queue rows tagged with the user's
 * current sessionId; only the subscriber for that sessionId can claim them
 * (`takeInputs`, delete-on-read). A stale stream still alive on another
 * instance therefore can't swallow input meant for the user's retry.
 *
 * Rows live seconds in practice and expire after INPUT_TTL_MS regardless
 * (guards.pruneExpired sweeps leftovers). A Duo passcode is single-use, so its
 * brief presence here is low-value to an attacker.
 *
 * Every function is gated by CONVEX_INTERNAL_SECRET; clerkId comes from the
 * route handler's Clerk auth().
 */

import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { assertInternalSecret } from "./internalSecret.helpers";

const INPUT_TTL_MS = 2 * 60_000;
/** Matches the stream's maxDuration (300 s) plus slack. */
const SESSION_TTL_MS = 310_000;
/** Backlog cap per session — a viewer never needs more than a handful in flight. */
const MAX_PENDING_PER_SESSION = 20;

async function deleteUserInputs(ctx: MutationCtx, clerkId: string): Promise<void> {
  const rows = await ctx.db
    .query("ssoInputs")
    .withIndex("by_clerkId_sessionId", (q) => q.eq("clerkId", clerkId))
    .take(MAX_PENDING_PER_SESSION * 5);
  for (const row of rows) await ctx.db.delete(row._id);
}

/** Registers `sessionId` as the user's live SSO stream, superseding any other. */
export const beginSession = mutation({
  args: { secret: v.string(), clerkId: v.string(), sessionId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    assertInternalSecret(args.secret);
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const existing = await ctx.db
      .query("ssoSessions")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { sessionId: args.sessionId, expiresAt });
    } else {
      await ctx.db.insert("ssoSessions", {
        clerkId: args.clerkId,
        sessionId: args.sessionId,
        expiresAt,
      });
    }
    await deleteUserInputs(ctx, args.clerkId);
  },
});

/** Clears the session row and its input, if it is still the current one. */
export const endSession = mutation({
  args: { secret: v.string(), clerkId: v.string(), sessionId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    assertInternalSecret(args.secret);
    const existing = await ctx.db
      .query("ssoSessions")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!existing || existing.sessionId !== args.sessionId) return;
    await ctx.db.delete(existing._id);
    await deleteUserInputs(ctx, args.clerkId);
  },
});

export const queueInput = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    input: v.union(
      v.object({
        kind: v.literal("click"),
        x: v.number(),
        y: v.number(),
        viewportWidth: v.number(),
        viewportHeight: v.number(),
      }),
      v.object({ kind: v.literal("type"), text: v.string() }),
      v.object({ kind: v.literal("pause"), paused: v.boolean() })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: true } | { ok: false; reason: "no-session" | "busy" }> => {
    assertInternalSecret(args.secret);
    const now = Date.now();

    const session = await ctx.db
      .query("ssoSessions")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!session || session.expiresAt <= now) return { ok: false, reason: "no-session" };

    const pending = await ctx.db
      .query("ssoInputs")
      .withIndex("by_clerkId_sessionId", (q) =>
        q.eq("clerkId", args.clerkId).eq("sessionId", session.sessionId)
      )
      .take(MAX_PENDING_PER_SESSION);
    let live = 0;
    for (const row of pending) {
      if (row.expiresAt > now) live++;
      else await ctx.db.delete(row._id);
    }
    if (live >= MAX_PENDING_PER_SESSION) return { ok: false, reason: "busy" };

    await ctx.db.insert("ssoInputs", {
      clerkId: args.clerkId,
      sessionId: session.sessionId,
      ...args.input,
      expiresAt: now + INPUT_TTL_MS,
    });
    return { ok: true };
  },
});

/** Subscribed to by the stream instance; returns only ids to keep it light. */
export const pendingInputs = query({
  args: { secret: v.string(), clerkId: v.string(), sessionId: v.string() },
  handler: async (ctx, args): Promise<Id<"ssoInputs">[]> => {
    assertInternalSecret(args.secret);
    const rows = await ctx.db
      .query("ssoInputs")
      .withIndex("by_clerkId_sessionId", (q) =>
        q.eq("clerkId", args.clerkId).eq("sessionId", args.sessionId)
      )
      .take(MAX_PENDING_PER_SESSION);
    return rows.map((row) => row._id);
  },
});

/**
 * Claims and deletes the given rows, returning only those still present,
 * unexpired, and belonging to this session — so a row is delivered at most
 * once, and only to the stream it was queued for.
 */
export const takeInputs = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    sessionId: v.string(),
    ids: v.array(v.id("ssoInputs")),
  },
  handler: async (ctx, args): Promise<Doc<"ssoInputs">[]> => {
    assertInternalSecret(args.secret);
    const now = Date.now();
    const taken: Doc<"ssoInputs">[] = [];
    for (const id of args.ids.slice(0, MAX_PENDING_PER_SESSION)) {
      const row = await ctx.db.get(id);
      if (!row || row.clerkId !== args.clerkId || row.sessionId !== args.sessionId) continue;
      await ctx.db.delete(id);
      if (row.expiresAt > now) taken.push(row);
    }
    return taken.sort((a, b) => a._creationTime - b._creationTime);
  },
});
