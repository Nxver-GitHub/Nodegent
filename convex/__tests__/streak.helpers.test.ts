import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  computeNextStreakState,
  dayKey,
  displayedStreak,
  effectiveTimezone,
  previousDayKey,
  safeTimezone,
} from "../streak.helpers";

const PACIFIC = "America/Los_Angeles";
const EASTERN = "America/New_York";

describe("safeTimezone", () => {
  it("returns the input when valid", () => {
    expect(safeTimezone("America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(safeTimezone("Europe/London")).toBe("Europe/London");
    expect(safeTimezone("UTC")).toBe("UTC");
  });

  it("returns undefined for invalid inputs", () => {
    expect(safeTimezone("Not/A/Zone")).toBeUndefined();
    expect(safeTimezone("")).toBeUndefined();
    expect(safeTimezone(undefined)).toBeUndefined();
  });
});

describe("effectiveTimezone", () => {
  it("returns the valid input", () => {
    expect(effectiveTimezone("Europe/Paris")).toBe("Europe/Paris");
  });
  it("falls back to Pacific for missing or invalid input", () => {
    expect(effectiveTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(effectiveTimezone("garbage")).toBe(DEFAULT_TIMEZONE);
  });
});

describe("dayKey", () => {
  it("formats as YYYY-MM-DD", () => {
    // 2026-06-15 12:00 UTC → Pacific = 2026-06-15 05:00 PDT
    expect(dayKey(Date.UTC(2026, 5, 15, 12, 0, 0), PACIFIC)).toBe("2026-06-15");
  });

  it("differentiates 11:59pm vs 12:01am Pacific (DST aware)", () => {
    // June (PDT, UTC-7): 23:59 PDT on Jun 15 = 06:59 UTC Jun 16.
    const justBeforeMidnightPdt = Date.UTC(2026, 5, 16, 6, 59, 0);
    // 00:01 PDT Jun 16 = 07:01 UTC Jun 16.
    const justAfterMidnightPdt = Date.UTC(2026, 5, 16, 7, 1, 0);
    expect(dayKey(justBeforeMidnightPdt, PACIFIC)).toBe("2026-06-15");
    expect(dayKey(justAfterMidnightPdt, PACIFIC)).toBe("2026-06-16");
  });

  it("yields different keys for different timezones at the same instant", () => {
    // 03:00 UTC = 22:00 prev day in NYC (EST, UTC-5), 19:00 prev day in LA (PST, UTC-8).
    // Use a January date to be unambiguously standard time.
    const ts = Date.UTC(2026, 0, 15, 3, 0, 0);
    expect(dayKey(ts, EASTERN)).toBe("2026-01-14");
    expect(dayKey(ts, PACIFIC)).toBe("2026-01-14");
    // 09:00 UTC same day → NYC 04:00 same day, LA 01:00 same day.
    const ts2 = Date.UTC(2026, 0, 15, 9, 0, 0);
    expect(dayKey(ts2, EASTERN)).toBe("2026-01-15");
    expect(dayKey(ts2, PACIFIC)).toBe("2026-01-15");
    // 06:00 UTC → NYC 01:00 same day, LA 22:00 prev day.
    const ts3 = Date.UTC(2026, 0, 15, 6, 0, 0);
    expect(dayKey(ts3, EASTERN)).toBe("2026-01-15");
    expect(dayKey(ts3, PACIFIC)).toBe("2026-01-14");
  });
});

describe("previousDayKey", () => {
  it("returns the prior calendar day", () => {
    expect(previousDayKey("2026-06-15", PACIFIC)).toBe("2026-06-14");
    expect(previousDayKey("2026-01-01", PACIFIC)).toBe("2025-12-31");
  });

  it("handles US Pacific spring-forward (2026-03-08)", () => {
    // March 8, 2026 is the US DST spring-forward day.
    expect(previousDayKey("2026-03-08", PACIFIC)).toBe("2026-03-07");
    expect(previousDayKey("2026-03-09", PACIFIC)).toBe("2026-03-08");
  });

  it("handles US Pacific fall-back (2026-11-01)", () => {
    // November 1, 2026 is the US DST fall-back day.
    expect(previousDayKey("2026-11-01", PACIFIC)).toBe("2026-10-31");
    expect(previousDayKey("2026-11-02", PACIFIC)).toBe("2026-11-01");
  });
});

describe("computeNextStreakState", () => {
  it("first-ever completion → current 1, longest 1", () => {
    const r = computeNextStreakState({}, "2026-06-15", PACIFIC);
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastCompletionDate: "2026-06-15",
    });
  });

  it("first-ever completion preserves a non-zero longest", () => {
    // Defensive: a user could have longestStreak set without a date in odd
    // post-migration states.
    const r = computeNextStreakState(
      { longestStreak: 9 },
      "2026-06-15",
      PACIFIC,
    );
    expect(r.next.longestStreak).toBe(9);
    expect(r.next.currentStreak).toBe(1);
  });

  it("same-day repeat is a no-op", () => {
    const r = computeNextStreakState(
      { currentStreak: 5, longestStreak: 7, lastCompletionDate: "2026-06-15" },
      "2026-06-15",
      PACIFIC,
    );
    expect(r.changed).toBe(false);
    expect(r.next.currentStreak).toBe(5);
    expect(r.next.longestStreak).toBe(7);
    expect(r.next.lastCompletionDate).toBe("2026-06-15");
  });

  it("consecutive day increments current and updates longest when surpassed", () => {
    const r = computeNextStreakState(
      { currentStreak: 5, longestStreak: 5, lastCompletionDate: "2026-06-14" },
      "2026-06-15",
      PACIFIC,
    );
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({
      currentStreak: 6,
      longestStreak: 6,
      lastCompletionDate: "2026-06-15",
    });
  });

  it("consecutive day preserves longest when not surpassed", () => {
    const r = computeNextStreakState(
      { currentStreak: 3, longestStreak: 10, lastCompletionDate: "2026-06-14" },
      "2026-06-15",
      PACIFIC,
    );
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({
      currentStreak: 4,
      longestStreak: 10,
      lastCompletionDate: "2026-06-15",
    });
  });

  it("gap of 2 days resets current to 1, preserves longest", () => {
    const r = computeNextStreakState(
      { currentStreak: 9, longestStreak: 12, lastCompletionDate: "2026-06-13" },
      "2026-06-15",
      PACIFIC,
    );
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({
      currentStreak: 1,
      longestStreak: 12,
      lastCompletionDate: "2026-06-15",
    });
  });

  it("gap across a DST boundary still resets correctly", () => {
    // 2026-03-06 → 2026-03-09 spans the spring-forward day.
    const r = computeNextStreakState(
      { currentStreak: 4, longestStreak: 4, lastCompletionDate: "2026-03-06" },
      "2026-03-09",
      PACIFIC,
    );
    expect(r.next.currentStreak).toBe(1);
  });

  it("consecutive across spring-forward bumps streak", () => {
    // Day before DST → DST day.
    const r = computeNextStreakState(
      { currentStreak: 3, longestStreak: 3, lastCompletionDate: "2026-03-07" },
      "2026-03-08",
      PACIFIC,
    );
    expect(r.next).toEqual({
      currentStreak: 4,
      longestStreak: 4,
      lastCompletionDate: "2026-03-08",
    });
  });

  it("defensive clock-skew (stored date > today) is a no-op", () => {
    const r = computeNextStreakState(
      { currentStreak: 5, longestStreak: 5, lastCompletionDate: "2099-12-31" },
      "2026-06-15",
      PACIFIC,
    );
    expect(r.changed).toBe(false);
    expect(r.next.currentStreak).toBe(5);
  });
});

describe("displayedStreak", () => {
  it("returns 0 when no lastCompletionDate", () => {
    expect(displayedStreak({}, "2026-06-15", PACIFIC)).toBe(0);
  });

  it("returns stored when last === today", () => {
    expect(
      displayedStreak(
        { currentStreak: 7, lastCompletionDate: "2026-06-15" },
        "2026-06-15",
        PACIFIC,
      ),
    ).toBe(7);
  });

  it("returns stored when last === yesterday (still extendable)", () => {
    expect(
      displayedStreak(
        { currentStreak: 7, lastCompletionDate: "2026-06-14" },
        "2026-06-15",
        PACIFIC,
      ),
    ).toBe(7);
  });

  it("returns 0 when last is older than yesterday", () => {
    expect(
      displayedStreak(
        { currentStreak: 9, lastCompletionDate: "2026-06-12" },
        "2026-06-15",
        PACIFIC,
      ),
    ).toBe(0);
  });

  it("returns 0 when currentStreak is undefined but date is recent", () => {
    expect(
      displayedStreak(
        { lastCompletionDate: "2026-06-15" },
        "2026-06-15",
        PACIFIC,
      ),
    ).toBe(0);
  });
});
