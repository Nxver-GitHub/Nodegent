/**
 * Lightweight in-memory rate limiter (fixed-window).
 *
 * Purpose
 * -------
 * Protects expensive API routes (headless-browser spawns, third-party fetches)
 * from abuse by an authenticated client that bypasses the UI and POSTs directly.
 *
 * Scope & limitations
 * -------------------
 *  - State lives in module memory, so limits are enforced PER server instance.
 *    On Vercel Fluid Compute a user's requests usually reuse a warm instance, so
 *    this meaningfully throttles bursts, but it is a best-effort first layer — not
 *    a distributed guarantee. Pair with a platform/WAF limit for hard enforcement.
 *  - Fixed-window (not sliding/token-bucket) — simple and predictable; a caller
 *    can send up to `limit` requests per window with no carry-over.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Opportunistically drop expired buckets so the map cannot grow unbounded. */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Milliseconds until the window resets (0 when the request is allowed). */
  retryAfterMs: number;
}

/**
 * Records a hit for `key` and reports whether it is within `limit` per `windowMs`.
 *
 * @param key      Unique per-caller bucket key (e.g. `"browse:" + userId`).
 * @param limit    Maximum allowed requests within the window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return { ok: true, retryAfterMs: 0 };
  }

  return { ok: false, retryAfterMs: bucket.resetAt - now };
}
