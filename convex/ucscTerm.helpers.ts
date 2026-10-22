// UCSC academic-term helpers.
//
// Pure functions only — no Convex imports. Used by the chat context builder
// (to scope Canvas enrollments to the current quarter), the chat tool
// descriptions (so term codes never go stale), and the Schedule of Classes
// sync route.
//
// Term codes follow pisa.ucsc.edu: "2" + 2-digit year + quarter digit
// (Winter 0, Spring 2, Summer 4, Fall 8) — e.g. Fall 2026 = 2268.
//
// Quarter boundaries (campus-local, inclusive):
//   Winter Jan 1 – Mar 31 · Spring Apr 1 – Jun 15
//   Summer Jun 16 – Sep 19 · Fall Sep 20 – Dec 31

import { CAMPUS_TZ } from "./timeUtil";

export type UcscSeason = "Winter" | "Spring" | "Summer" | "Fall";

export interface UcscTerm {
  code: string;
  name: string;
  season: UcscSeason;
  year: number;
}

const SEASON_ORDER: readonly UcscSeason[] = ["Winter", "Spring", "Summer", "Fall"];

const SEASON_DIGIT: Record<UcscSeason, string> = {
  Winter: "0",
  Spring: "2",
  Summer: "4",
  Fall: "8",
};

function makeTerm(season: UcscSeason, year: number): UcscTerm {
  const yy = String(year % 100).padStart(2, "0");
  return { code: `2${yy}${SEASON_DIGIT[season]}`, name: `${season} ${year}`, season, year };
}

/** Campus-local calendar date (year, 1-based month, day) for an instant. */
function campusYMD(nowMs: number): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const p = (t: string): number => Number(parts.find((x) => x.type === t)?.value ?? 0);
  return { year: p("year"), month: p("month"), day: p("day") };
}

function seasonFor(month: number, day: number): UcscSeason {
  // Compare as MMDD so the boundary days read like the table above.
  const mmdd = month * 100 + day;
  if (mmdd <= 331) return "Winter";
  if (mmdd <= 615) return "Spring";
  if (mmdd <= 919) return "Summer";
  return "Fall";
}

/** The UCSC quarter in session (or most recently started) at `nowMs`. */
export function currentUcscTerm(nowMs: number): UcscTerm {
  const { year, month, day } = campusYMD(nowMs);
  return makeTerm(seasonFor(month, day), year);
}

/** The quarter after the current one (Fall rolls over to next year's Winter). */
export function nextUcscTerm(nowMs: number): UcscTerm {
  const current = currentUcscTerm(nowMs);
  const idx = SEASON_ORDER.indexOf(current.season);
  return idx === SEASON_ORDER.length - 1
    ? makeTerm("Winter", current.year + 1)
    : makeTerm(SEASON_ORDER[idx + 1], current.year);
}

/**
 * Does a free-form Canvas term name ("Fall 2026", "2026 Fall Quarter",
 * "FALL QUARTER 2026") refer to the current quarter? Requires both a season
 * word and a 4-digit year; anything else ("Unknown Term", "Default Term",
 * training shells) is treated as not current.
 */
export function isCurrentTermName(canvasTermName: string | undefined, nowMs: number): boolean {
  if (!canvasTermName) return false;
  const lower = canvasTermName.toLowerCase();
  const seasonMatch = lower.match(/\b(winter|spring|summer|fall)\b/);
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (!seasonMatch || !yearMatch) return false;

  const current = currentUcscTerm(nowMs);
  return seasonMatch[1] === current.season.toLowerCase() && Number(yearMatch[1]) === current.year;
}
