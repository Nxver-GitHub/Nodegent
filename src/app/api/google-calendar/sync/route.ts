/**
 * POST /api/google-calendar/sync
 * --------------------------------
 * Syncs Canvas assignments to Google Calendar (push) and pulls Google Calendar
 * events back into Nodegent's events table.
 *
 * Auth:
 *  - Requires Clerk auth (user must be signed in)
 *  - Gets the Google OAuth token from Clerk (Calendar scopes requested at sign-in)
 *  - Communicates with Convex via CONVEX_INTERNAL_SECRET
 *
 * No Google Calendar tokens are stored — Clerk manages OAuth token lifecycle.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import {
  createCalendarEvent,
  updateCalendarEvent,
  listCalendarEvents,
  assignmentToGcalEvent,
} from "@/lib/google-calendar";

export async function POST(request: NextRequest): Promise<NextResponse> {
  void request;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalSecret = process.env.CONVEX_INTERNAL_SECRET;
  if (!internalSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: CONVEX_INTERNAL_SECRET not set" },
      { status: 500 }
    );
  }

  // Check access toggle — calendarEnabled === false means sync is paused
  const settings = await fetchQuery(api.users.getUserSettingsInternal, {
    clerkUserId: userId,
    internalSecret,
  });
  if (settings?.calendarEnabled === false) {
    return NextResponse.json(
      {
        error: "Google Calendar sync is disabled. Enable it in your access settings.",
        code: "CALENDAR_DISABLED",
      },
      { status: 403 }
    );
  }

  // Get Google OAuth token from Clerk
  const client = await clerkClient();
  const tokenResponse = await client.users.getUserOauthAccessToken(
    userId,
    "oauth_google"
  );
  const googleToken = tokenResponse.data?.[0]?.token;

  if (!googleToken) {
    return NextResponse.json(
      {
        error:
          "Google Calendar access not granted. Please sign out and sign back in to enable Calendar sync.",
        code: "NO_GOOGLE_TOKEN",
      },
      { status: 403 }
    );
  }

  let eventsPushed = 0;
  let eventsPulled = 0;
  const pushErrors: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // PUSH: Canvas assignments → Google Calendar
    // -------------------------------------------------------------------------
    const assignments = await fetchQuery(
      api.googleCalendar.getAssignmentsForPushInternal,
      { clerkUserId: userId, internalSecret }
    );

    for (const assignment of assignments) {
      const gcalEvent = assignmentToGcalEvent(assignment);

      try {
        if (assignment.googleCalendarEventId) {
          // Try to update the existing event; fall back to create if deleted
          try {
            await updateCalendarEvent(
              googleToken,
              assignment.googleCalendarEventId,
              gcalEvent
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg.includes("404") || msg.includes("410")) {
              // Event was deleted from Google Calendar — recreate it
              const created = await createCalendarEvent(googleToken, gcalEvent);
              await fetchMutation(api.googleCalendar.patchAssignmentGcalEventId, {
                clerkUserId: userId,
                internalSecret,
                assignmentId: assignment._id,
                gcalEventId: created.id,
              });
            } else {
              throw err;
            }
          }
        } else {
          const created = await createCalendarEvent(googleToken, gcalEvent);
          await fetchMutation(api.googleCalendar.patchAssignmentGcalEventId, {
            clerkUserId: userId,
            internalSecret,
            assignmentId: assignment._id,
            gcalEventId: created.id,
          });
        }
        eventsPushed++;
      } catch (err) {
        // Don't abort the whole sync for a single assignment failure
        pushErrors.push(
          `${assignment.title}: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    // -------------------------------------------------------------------------
    // PULL: Google Calendar → Nodegent events table
    // -------------------------------------------------------------------------
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 1); // yesterday
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + 90); // 90 days out

    const gcalEvents = await listCalendarEvents(googleToken, timeMin, timeMax);

    for (const event of gcalEvents) {
      if (!event.id || !event.start?.dateTime) continue;

      const startAt = new Date(event.start.dateTime).getTime();
      const endAt = event.end?.dateTime
        ? new Date(event.end.dateTime).getTime()
        : undefined;

      await fetchMutation(api.googleCalendar.upsertGcalEventInternal, {
        clerkUserId: userId,
        internalSecret,
        externalId: `gcal:${event.id}`,
        title: event.summary ?? "Untitled event",
        startAt,
        endAt,
        location: event.location,
      });
      eventsPulled++;
    }

    // Update sync status
    await fetchMutation(api.googleCalendar.updateCalendarSyncStatusInternal, {
      clerkUserId: userId,
      internalSecret,
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      eventsPushed,
      eventsPulled,
      ...(pushErrors.length > 0 ? { pushErrors } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";

    await fetchMutation(
      api.googleCalendar.updateCalendarSyncStatusInternal,
      {
        clerkUserId: userId,
        internalSecret,
        status: "error",
        error: message,
      }
    ).catch(() => {
      // Don't swallow the original error if status update fails
    });

    // Surface auth errors explicitly so the UI can show re-sign-in prompt
    if (message.startsWith("GOOGLE_AUTH_EXPIRED") || message.startsWith("GOOGLE_FORBIDDEN")) {
      return NextResponse.json({ error: message, code: "GOOGLE_AUTH_ERROR" }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
