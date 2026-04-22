import { describe, it, expect } from "vitest";
import { getUrgency } from "../AssignmentCard";

describe("getUrgency", () => {
  it("returns 'overdue' for past timestamps", () => {
    expect(getUrgency(Date.now() - 1000)).toBe("overdue");
  });

  it("returns 'today' for timestamps within 24 hours", () => {
    expect(getUrgency(Date.now() + 60 * 60 * 1000)).toBe("today");
  });

  it("returns 'soon' for timestamps between 24h and 3 days", () => {
    expect(getUrgency(Date.now() + 2 * 24 * 60 * 60 * 1000)).toBe("soon");
  });

  it("returns 'upcoming' for timestamps beyond 3 days", () => {
    expect(getUrgency(Date.now() + 7 * 24 * 60 * 60 * 1000)).toBe("upcoming");
  });

  it("returns 'upcoming' for undefined dueAt", () => {
    expect(getUrgency(undefined)).toBe("upcoming");
  });
});
