import { describe, expect, it } from "vitest";
import { groqRetryAfterMs } from "../groqModel.helpers";

describe("groqRetryAfterMs", () => {
  it("prefers retry-after seconds", () => {
    expect(groqRetryAfterMs(new Headers({ "retry-after": "2", "x-ratelimit-reset-tokens": "9s" }))).toBe(2000);
  });

  it("parses Groq reset durations", () => {
    expect(groqRetryAfterMs(new Headers({ "x-ratelimit-reset-tokens": "577ms" }))).toBe(577);
    expect(groqRetryAfterMs(new Headers({ "x-ratelimit-reset-tokens": "3.367s" }))).toBe(3367);
    expect(groqRetryAfterMs(new Headers({ "x-ratelimit-reset-tokens": "1m2.5s" }))).toBe(62500);
  });

  it("returns null without usable headers", () => {
    expect(groqRetryAfterMs(new Headers())).toBeNull();
    expect(groqRetryAfterMs(new Headers({ "x-ratelimit-reset-tokens": "soon" }))).toBeNull();
  });
});
