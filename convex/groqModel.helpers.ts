/**
 * Fallback Groq model when the GROQ_MODEL env var is unset.
 *
 * Groq retires models without notice (llama-4-scout and llama-3.3-70b were
 * both pulled), so keep this to one place. Must support tool calling (chat's
 * browse_web/MCP tools) and strict JSON output (office-hours extraction).
 */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/** Longest we'll wait for Groq's token bucket before giving up on a request. */
export const GROQ_MAX_RETRY_WAIT_MS = 8_000;

/**
 * How long Groq says to wait after a 429, from `retry-after` (seconds) or
 * `x-ratelimit-reset-tokens` (e.g. "577ms", "3.4s", "1m2.5s"). Null if neither
 * header is usable.
 */
export function groqRetryAfterMs(headers: Headers): number | null {
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;

  const reset = headers.get("x-ratelimit-reset-tokens");
  if (!reset) return null;
  const parts = [...reset.matchAll(/(\d+(?:\.\d+)?)(ms|m|s)/g)];
  if (parts.length === 0) return null;
  const unitMs = { ms: 1, s: 1000, m: 60_000 } as const;
  return Math.ceil(
    parts.reduce((sum, [, n, unit]) => sum + Number(n) * unitMs[unit as keyof typeof unitMs], 0)
  );
}
