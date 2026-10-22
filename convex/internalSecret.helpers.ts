/**
 * Shared-secret gate for server-to-Convex calls from Next.js Route Handlers.
 *
 * Route handlers authenticate the user with Clerk, then call Convex with
 * CONVEX_INTERNAL_SECRET instead of forwarding the Clerk session token (which
 * expires in ~60 s — too short for a Duo MFA login that can take minutes).
 * Functions gated by this helper trust the clerkId the caller passes, so the
 * secret must never reach the browser.
 */

/** Constant-time string comparison (no node:crypto in the default runtime). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function assertInternalSecret(secret: string): void {
  const expected = process.env.CONVEX_INTERNAL_SECRET;
  if (!expected || !safeEqual(secret, expected)) {
    throw new Error("Unauthorized");
  }
}
