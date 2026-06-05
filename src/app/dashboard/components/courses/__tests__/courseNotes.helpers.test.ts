import { describe, expect, it } from "vitest";
import {
  MAX_NOTE_CONTENT_CHARS,
  isSubmitKey,
  isCancelKey,
  validateNoteDraft,
  formatRelativeTime,
} from "../courseNotes.helpers";

const baseKey = {
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
};

describe("isSubmitKey", () => {
  it("returns true for bare Enter", () => {
    expect(isSubmitKey({ ...baseKey, key: "Enter" })).toBe(true);
  });
  it("returns false for Shift+Enter (newline)", () => {
    expect(isSubmitKey({ ...baseKey, key: "Enter", shiftKey: true })).toBe(false);
  });
  it("returns false for Cmd+Enter / Ctrl+Enter", () => {
    expect(isSubmitKey({ ...baseKey, key: "Enter", metaKey: true })).toBe(false);
    expect(isSubmitKey({ ...baseKey, key: "Enter", ctrlKey: true })).toBe(false);
  });
  it("returns false for other keys", () => {
    expect(isSubmitKey({ ...baseKey, key: "a" })).toBe(false);
    expect(isSubmitKey({ ...baseKey, key: "Escape" })).toBe(false);
  });
});

describe("isCancelKey", () => {
  it("returns true only for Escape", () => {
    expect(isCancelKey({ key: "Escape" })).toBe(true);
    expect(isCancelKey({ key: "Enter" })).toBe(false);
    expect(isCancelKey({ key: "a" })).toBe(false);
  });
});

describe("validateNoteDraft", () => {
  it("rejects empty drafts", () => {
    expect(validateNoteDraft("")).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects whitespace-only drafts", () => {
    expect(validateNoteDraft("   \n  ")).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects drafts above the cap (post-trim)", () => {
    const long = " " + "a".repeat(MAX_NOTE_CONTENT_CHARS + 1) + " ";
    expect(validateNoteDraft(long)).toEqual({ ok: false, reason: "too_long" });
  });
  it("accepts drafts exactly at the cap (post-trim)", () => {
    const atCap = "a".repeat(MAX_NOTE_CONTENT_CHARS);
    expect(validateNoteDraft(atCap)).toEqual({ ok: true, trimmed: atCap });
  });
  it("returns the trimmed string when ok", () => {
    expect(validateNoteDraft("  hello  ")).toEqual({
      ok: true,
      trimmed: "hello",
    });
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for sub-5s deltas", () => {
    const now = 10_000;
    expect(formatRelativeTime(now - 1000, now)).toBe("just now");
  });
  it("uses seconds for sub-minute deltas", () => {
    const now = 1_000_000;
    expect(formatRelativeTime(now - 30_000, now)).toBe("30s ago");
  });
  it("uses minutes for sub-hour deltas", () => {
    const now = 1_000_000;
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
  });
  it("uses hours for sub-day deltas", () => {
    const now = 1_000_000_000;
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
  it("uses days for sub-week deltas", () => {
    const now = 5_000_000_000;
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
  it("falls back to a calendar date past one week", () => {
    const now = 10_000_000_000;
    const past = now - 30 * 86_400_000;
    const result = formatRelativeTime(past, now);
    expect(result).not.toMatch(/ago/);
    expect(result.length).toBeGreaterThan(0);
  });
  it("clamps negative deltas to 'just now'", () => {
    const now = 100;
    expect(formatRelativeTime(now + 5000, now)).toBe("just now");
  });
});

describe("MAX_NOTE_CONTENT_CHARS", () => {
  it("matches the Convex-side cap", () => {
    expect(MAX_NOTE_CONTENT_CHARS).toBe(2_000);
  });
});
