// US-8.3: Streak tracking helpers.
//
// Pure functions only — no Convex imports. Server-side mutations and queries
// import these, and the helper-test suite covers every branch.
//
// Design notes:
//   - lastCompletionDate is stored as YYYY-MM-DD in the user's timezone.
//     A calendar-day key is unambiguous, trivially comparable, and avoids
//     re-bucketing on every read.
//   - "Store raw, display resolved" — `currentStreak` is the value at the
//     last completion; `displayedStreak` applies the gap reset on read so
//     stale streaks expire without an extra write.
//   - Default timezone is "America/Los_Angeles" for users without one
//     persisted yet. Multi-university v2 promotes the per-user value.

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

// Validate an IANA timezone string. Returns the valid input or undefined.
// Uses Intl.DateTimeFormat construction as the source of truth; if the
// runtime accepts it, we accept it.
export function safeTimezone(tz: string | undefined): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

// Resolve the effective timezone for a user, falling back to Pacific.
export function effectiveTimezone(tz: string | undefined): string {
  return safeTimezone(tz) ?? DEFAULT_TIMEZONE;
}

// Returns YYYY-MM-DD for the given epoch ms in the given timezone.
// `en-CA` natively formats as YYYY-MM-DD with zero padding.
export function dayKey(ts: number, tz: string = DEFAULT_TIMEZONE): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(ts));
}

// Returns YYYY-MM-DD for the day before `todayKey` in the same timezone.
// Anchors at noon UTC to side-step DST off-by-one when crossing transitions.
export function previousDayKey(todayKey: string, tz: string = DEFAULT_TIMEZONE): string {
  const [y, m, d] = todayKey.split("-").map((s) => Number.parseInt(s, 10));
  const noonUtcToday = Date.UTC(y, m - 1, d, 12, 0, 0);
  const noonUtcYesterday = noonUtcToday - 24 * 60 * 60 * 1000;
  return dayKey(noonUtcYesterday, tz);
}

export interface StreakState {
  currentStreak?: number;
  longestStreak?: number;
  lastCompletionDate?: string;
}

export interface StreakTransition {
  next: {
    currentStreak: number;
    longestStreak: number;
    lastCompletionDate: string;
  };
  changed: boolean;
}

// Pure state-machine step. Called only on the false→true transition of
// `markComplete`. Returns `changed: false` for same-day repeats and the
// defensive clock-skew branch so the caller can skip the patch entirely.
export function computeNextStreakState(
  prev: StreakState,
  todayKey: string,
  tz: string = DEFAULT_TIMEZONE,
): StreakTransition {
  const prevCurrent = prev.currentStreak ?? 0;
  const prevLongest = prev.longestStreak ?? 0;
  const prevDate = prev.lastCompletionDate;

  // First-ever completion.
  if (!prevDate) {
    return {
      next: {
        currentStreak: 1,
        longestStreak: Math.max(1, prevLongest),
        lastCompletionDate: todayKey,
      },
      changed: true,
    };
  }

  // Same-day repeat — no work.
  if (prevDate === todayKey) {
    return {
      next: {
        currentStreak: prevCurrent,
        longestStreak: prevLongest,
        lastCompletionDate: prevDate,
      },
      changed: false,
    };
  }

  // Defensive clock-skew: stored date is in the future of "today".
  if (prevDate > todayKey) {
    return {
      next: {
        currentStreak: prevCurrent,
        longestStreak: prevLongest,
        lastCompletionDate: prevDate,
      },
      changed: false,
    };
  }

  const yesterday = previousDayKey(todayKey, tz);

  // Consecutive day.
  if (prevDate === yesterday) {
    const nextCurrent = prevCurrent + 1;
    return {
      next: {
        currentStreak: nextCurrent,
        longestStreak: Math.max(nextCurrent, prevLongest),
        lastCompletionDate: todayKey,
      },
      changed: true,
    };
  }

  // Gap of 2+ days — reset to 1, longest preserved.
  return {
    next: {
      currentStreak: 1,
      longestStreak: Math.max(1, prevLongest),
      lastCompletionDate: todayKey,
    },
    changed: true,
  };
}

// Read-side gap reset. Returns the streak number to display given the
// stored state and "today" in the user's timezone.
//   - last === today           → show stored
//   - last === yesterday       → show stored (user can still extend today)
//   - last older / undefined   → 0 (streak broken)
export function displayedStreak(
  state: StreakState,
  todayKey: string,
  tz: string = DEFAULT_TIMEZONE,
): number {
  const stored = state.currentStreak ?? 0;
  const last = state.lastCompletionDate;
  if (!last) return 0;
  if (last === todayKey) return stored;
  if (last === previousDayKey(todayKey, tz)) return stored;
  return 0;
}
