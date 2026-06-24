/**
 * Campus-timezone helpers.
 *
 * Convex actions/queries run in UTC, so any "today" computed with the server's
 * local clock (`new Date().getDate()`, `setHours(0,0,0,0)`, etc.) is wrong for
 * UCSC users after ~5pm Pacific, when UTC has already rolled to the next day.
 * These helpers anchor "today" to the campus timezone instead.
 */

export const CAMPUS_TZ = "America/Los_Angeles";

/** UTC epoch ms for 00:00 of the current campus-local (Pacific) day. */
export function startOfCampusDay(nowMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(nowMs));
  const p = (t: string): number => Number(parts.find((x) => x.type === t)?.value ?? 0);

  // Reinterpret the Pacific wall-clock components as if they were UTC, then the
  // difference from the real instant is the timezone offset (whole minutes).
  const wallAsUtc = Date.UTC(p("year"), p("month") - 1, p("day"), p("hour"), p("minute"), p("second"));
  const offset = Math.round((wallAsUtc - nowMs) / 60_000) * 60_000;
  return Date.UTC(p("year"), p("month") - 1, p("day"), 0, 0, 0) - offset;
}

/** MM/DD/YYYY for the campus-local day, optionally offset by `addDays`. */
export function campusDateMDY(nowMs: number, addDays = 0): string {
  // Read the campus-local calendar date, then advance whole days via UTC math
  // (UTC has no DST, so day-component arithmetic is exact — avoids the off-by-one
  // a raw `+addDays*86_400_000` would cause on DST-transition nights).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const p = (t: string): number => Number(parts.find((x) => x.type === t)?.value ?? 0);
  const d = new Date(Date.UTC(p("year"), p("month") - 1, p("day") + addDays));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}
