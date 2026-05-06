// ---------------------------------------------------------------------------
// Google Calendar REST API utility
// Uses raw fetch — no googleapis npm package required.
// All functions throw on API errors with descriptive messages.
// ---------------------------------------------------------------------------

export interface GcalEventInput {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  source?: { title: string; url: string };
}

export interface GcalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  status?: string;
  htmlLink?: string;
}

interface GcalEventsListResponse {
  items?: GcalEvent[];
  nextPageToken?: string;
}

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function gcalFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("GOOGLE_AUTH_EXPIRED: Google Calendar access has expired. Please sign out and sign back in.");
    }
    if (res.status === 403) {
      throw new Error("GOOGLE_FORBIDDEN: Insufficient Calendar permissions. Please sign out and sign back in to grant Calendar access.");
    }
    throw new Error(`Google Calendar API error ${res.status}: ${body}`);
  }

  return res;
}

export async function createCalendarEvent(
  token: string,
  event: GcalEventInput
): Promise<GcalEvent> {
  const res = await gcalFetch(
    `${CALENDAR_API}/calendars/primary/events`,
    token,
    { method: "POST", body: JSON.stringify(event) }
  );
  return res.json() as Promise<GcalEvent>;
}

export async function updateCalendarEvent(
  token: string,
  eventId: string,
  event: GcalEventInput
): Promise<GcalEvent> {
  const res = await gcalFetch(
    `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    token,
    { method: "PUT", body: JSON.stringify(event) }
  );
  return res.json() as Promise<GcalEvent>;
}

/**
 * Fetches all events from the user's primary calendar within the given window.
 * Handles pagination automatically (up to 500 events).
 * Skips all-day events (no dateTime) since they don't have a meaningful time.
 */
export async function listCalendarEvents(
  token: string,
  timeMin: Date,
  timeMax: Date
): Promise<GcalEvent[]> {
  const events: GcalEvent[] = [];
  let pageToken: string | undefined;
  const MAX_PAGES = 5;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await gcalFetch(
      `${CALENDAR_API}/calendars/primary/events?${params}`,
      token
    );
    const data = (await res.json()) as GcalEventsListResponse;

    for (const event of data.items ?? []) {
      // Skip events without a dateTime (all-day events)
      if (event.start?.dateTime) {
        events.push(event);
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return events;
}

/**
 * Builds a Google Calendar event from a Canvas assignment.
 * The event spans 1 hour ending at the due date.
 */
export function assignmentToGcalEvent(assignment: {
  title: string;
  courseCode: string;
  dueAt: number;
  htmlUrl?: string;
}): GcalEventInput {
  const endDate = new Date(assignment.dueAt);
  const startDate = new Date(assignment.dueAt - 60 * 60 * 1000); // 1 hour before due

  const event: GcalEventInput = {
    summary: `Due: ${assignment.title}`,
    description: `Course: ${assignment.courseCode}${assignment.htmlUrl ? `\n\nView on Canvas: ${assignment.htmlUrl}` : ""}`,
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
  };

  if (assignment.htmlUrl) {
    event.source = { title: "Canvas", url: assignment.htmlUrl };
  }

  return event;
}
