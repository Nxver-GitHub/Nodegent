import { describe, expect, it } from "vitest";
import { currentUcscTerm, isCurrentTermName, nextUcscTerm } from "../ucscTerm.helpers";

// Noon Pacific on a given campus-local date (PDT/PST offsets both land mid-day UTC).
const pacificNoon = (iso: string): number => Date.parse(`${iso}T20:00:00Z`);

describe("currentUcscTerm", () => {
  it("returns Fall 2026 (2268) in late October 2026", () => {
    expect(currentUcscTerm(pacificNoon("2026-10-21"))).toMatchObject({
      code: "2268",
      name: "Fall 2026",
    });
  });

  it.each([
    ["2027-01-01", "2270", "Winter 2027"],
    ["2027-03-31", "2270", "Winter 2027"],
    ["2027-04-01", "2272", "Spring 2027"],
    ["2027-06-15", "2272", "Spring 2027"],
    ["2027-06-16", "2274", "Summer 2027"],
    ["2027-09-19", "2274", "Summer 2027"],
    ["2027-09-20", "2278", "Fall 2027"],
    ["2026-12-31", "2268", "Fall 2026"],
  ])("on %s → %s (%s)", (date, code, name) => {
    expect(currentUcscTerm(pacificNoon(date))).toMatchObject({ code, name });
  });

  it("uses campus time, not UTC, at the year boundary", () => {
    // 2027-01-01 03:00 UTC is still Dec 31 2026 in Santa Cruz.
    expect(currentUcscTerm(Date.parse("2027-01-01T03:00:00Z")).name).toBe("Fall 2026");
  });
});

describe("nextUcscTerm", () => {
  it("rolls Fall over to next year's Winter", () => {
    expect(nextUcscTerm(pacificNoon("2026-10-21"))).toMatchObject({
      code: "2270",
      name: "Winter 2027",
    });
  });

  it("advances within the same year", () => {
    expect(nextUcscTerm(pacificNoon("2027-02-10")).code).toBe("2272");
    expect(nextUcscTerm(pacificNoon("2027-05-01")).code).toBe("2274");
    expect(nextUcscTerm(pacificNoon("2027-07-04")).code).toBe("2278");
  });
});

describe("isCurrentTermName", () => {
  const now = pacificNoon("2026-10-21");

  it.each(["Fall 2026", "2026 Fall Quarter", "FALL QUARTER 2026", "fall 2026"])(
    "matches %s",
    (name) => {
      expect(isCurrentTermName(name, now)).toBe(true);
    }
  );

  it.each([
    "Unknown Term",
    "Default Term",
    "Spring 2026",
    "Fall 2024",
    "2024 Slugs CARE, Title IX, & SHOP 2",
    "Fall",
    "2026",
    "",
  ])("rejects %s", (name) => {
    expect(isCurrentTermName(name, now)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isCurrentTermName(undefined, now)).toBe(false);
  });
});
