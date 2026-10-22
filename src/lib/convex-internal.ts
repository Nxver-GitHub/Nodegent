/**
 * Server-only helpers for Next.js Route Handlers that call Convex functions
 * gated by CONVEX_INTERNAL_SECRET (convex/guards.ts, convex/ssoRelay.ts).
 *
 * Callers MUST authenticate the user with Clerk first — these functions trust
 * the clerkId they are given.
 */

import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export type RateLimitBucket =
  | "canvasStream"
  | "canvasInput"
  | "browse"
  | "calendarSync"
  | "slugSchedule";

export function getInternalSecret(): string {
  const secret = process.env.CONVEX_INTERNAL_SECRET;
  if (!secret) throw new Error("CONVEX_INTERNAL_SECRET is not configured");
  return secret;
}

/**
 * Consumes one hit from a cross-instance rate-limit bucket. Returns a 429
 * response when the caller is over the limit, a 503 if the limiter itself is
 * unreachable (fail closed), or null to proceed.
 */
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  clerkId: string
): Promise<NextResponse | null> {
  let result: { ok: boolean; retryAfterMs: number };
  try {
    result = await fetchMutation(api.guards.consumeRateLimit, {
      secret: getInternalSecret(),
      bucket,
      clerkId,
    });
  } catch (err) {
    console.error("[rate-limit] limiter unavailable:", err);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "10" } }
    );
  }
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) } }
  );
}

/** Acquires a slot in the global headless-Chromium pool, or null if full. */
export async function acquireBrowserLease(
  kind: "canvasSso" | "browse",
  owner: string,
  ttlMs: number
): Promise<Id<"browserLeases"> | null> {
  const { leaseId } = await fetchMutation(api.guards.acquireBrowserLease, {
    secret: getInternalSecret(),
    kind,
    owner,
    ttlMs,
  });
  return leaseId;
}

/** Best-effort release; the lease expires on its own if this fails. */
export async function releaseBrowserLease(leaseId: Id<"browserLeases">): Promise<void> {
  await fetchMutation(api.guards.releaseBrowserLease, {
    secret: getInternalSecret(),
    leaseId,
  }).catch((err: unknown) => console.error("[browser-lease] release failed:", err));
}
