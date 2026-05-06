import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assignmentToGcalEvent,
  createCalendarEvent,
  listCalendarEvents,
  type GcalEvent,
} from "../google-calendar";

// ---------------------------------------------------------------------------
// assignmentToGcalEvent — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe("assignmentToGcalEvent", () => {
  const BASE = {
    title: "Final Project",
    courseCode: "CSE 115A",
    dueAt: 1_750_000_000_000, // fixed valid future timestamp
    htmlUrl: "https://canvas.ucsc.edu/assignments/1",
  };

  it("creates event with correct summary and 1-hour window ending at dueAt", () => {
    const event = assignmentToGcalEvent(BASE);
    expect(event.summary).toBe("Due: Final Project");
    const end = new Date(event.end.dateTime).getTime();
    const start = new Date(event.start.dateTime).getTime();
    expect(end).toBe(BASE.dueAt);
    expect(end - start).toBe(60 * 60 * 1000);
  });

  it("includes course code and Canvas URL in description", () => {
    const event = assignmentToGcalEvent(BASE);
    expect(event.description).toContain("CSE 115A");
    expect(event.description).toContain(BASE.htmlUrl);
  });

  it("sets source link when htmlUrl provided", () => {
    const event = assignmentToGcalEvent(BASE);
    expect(event.source?.url).toBe(BASE.htmlUrl);
    expect(event.source?.title).toBe("Canvas");
  });

  it("omits source when no htmlUrl", () => {
    const { htmlUrl: _url, ...noUrl } = BASE;
    const event = assignmentToGcalEvent(noUrl);
    expect(event.source).toBeUndefined();
  });

  it("throws when title is empty string", () => {
    expect(() => assignmentToGcalEvent({ ...BASE, title: "" })).toThrow(
      "Assignment title is required"
    );
  });

  it("throws when title is only whitespace", () => {
    expect(() => assignmentToGcalEvent({ ...BASE, title: "   " })).toThrow(
      "Assignment title is required"
    );
  });

  it("throws when dueAt is 0", () => {
    expect(() => assignmentToGcalEvent({ ...BASE, dueAt: 0 })).toThrow(
      "no valid due date"
    );
  });

  it("throws when dueAt is NaN", () => {
    expect(() => assignmentToGcalEvent({ ...BASE, dueAt: NaN })).toThrow(
      "no valid due date"
    );
  });

  it("throws when dueAt is negative", () => {
    expect(() => assignmentToGcalEvent({ ...BASE, dueAt: -1 })).toThrow(
      "no valid due date"
    );
  });
});

// ---------------------------------------------------------------------------
// createCalendarEvent — requires mocked fetch
// ---------------------------------------------------------------------------

describe("createCalendarEvent", () => {
  const TOKEN = "ya29.fake-token";
  const EVENT = {
    summary: "Due: Test Assignment",
    start: { dateTime: "2026-06-01T09:00:00Z" },
    end: { dateTime: "2026-06-01T10:00:00Z" },
  };

  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns the created event on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "gcal_abc" }), { status: 200 })
    );
    const result = await createCalendarEvent(TOKEN, EVENT);
    expect(result.id).toBe("gcal_abc");
  });

  it("sends Authorization header with Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "x" }), { status: 200 })
    );
    await createCalendarEvent(TOKEN, EVENT);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/calendars/primary/events"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      })
    );
  });

  it("throws GOOGLE_AUTH_EXPIRED on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );
    await expect(createCalendarEvent(TOKEN, EVENT)).rejects.toThrow(
      "GOOGLE_AUTH_EXPIRED"
    );
  });

  it("throws GOOGLE_FORBIDDEN on 403", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );
    await expect(createCalendarEvent(TOKEN, EVENT)).rejects.toThrow(
      "GOOGLE_FORBIDDEN"
    );
  });

  it("throws rate limit message on 429", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Too Many Requests", { status: 429 })
    );
    await expect(createCalendarEvent(TOKEN, EVENT)).rejects.toThrow(
      "rate limit"
    );
  });

  it("throws service unavailable on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );
    await expect(createCalendarEvent(TOKEN, EVENT)).rejects.toThrow(
      "temporarily unavailable"
    );
  });
});

// ---------------------------------------------------------------------------
// listCalendarEvents — requires mocked fetch
// ---------------------------------------------------------------------------

describe("listCalendarEvents", () => {
  const TOKEN = "ya29.fake-token";
  const TIME_MIN = new Date("2026-01-01");
  const TIME_MAX = new Date("2026-04-01");

  function makeEvent(id: string): GcalEvent {
    return {
      id,
      summary: `Event ${id}`,
      start: { dateTime: "2026-01-15T10:00:00Z" },
      end: { dateTime: "2026-01-15T11:00:00Z" },
    };
  }

  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns events from a single page", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ items: [makeEvent("e1"), makeEvent("e2")] }),
        { status: 200 }
      )
    );
    const events = await listCalendarEvents(TOKEN, TIME_MIN, TIME_MAX);
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe("e1");
  });

  it("skips all-day events (no dateTime in start)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            makeEvent("e1"),
            { id: "holiday", summary: "Holiday", start: { date: "2026-01-20" } },
          ],
        }),
        { status: 200 }
      )
    );
    const events = await listCalendarEvents(TOKEN, TIME_MIN, TIME_MAX);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("e1");
  });

  it("returns empty array when no items", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );
    const events = await listCalendarEvents(TOKEN, TIME_MIN, TIME_MAX);
    expect(events).toHaveLength(0);
  });

  it("follows pagination via nextPageToken", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [makeEvent("p1")], nextPageToken: "tok123" }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [makeEvent("p2")] }),
          { status: 200 }
        )
      );
    const events = await listCalendarEvents(TOKEN, TIME_MIN, TIME_MAX);
    expect(events).toHaveLength(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    // Second call includes pageToken in the URL
    const secondCallUrl = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(secondCallUrl).toContain("pageToken=tok123");
  });
});
