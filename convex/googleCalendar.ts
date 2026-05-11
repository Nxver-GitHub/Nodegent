import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Public query — returns calendar sync status to the UI, never credentials
// ---------------------------------------------------------------------------

export const getCalendarSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    return {
      lastCalendarSyncAt: user.lastCalendarSyncAt,
      lastCalendarSyncStatus: user.lastCalendarSyncStatus,
      // Map stored "" (written on success to clear a prior error) back to undefined
      lastCalendarSyncError: user.lastCalendarSyncError || undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// getAssignmentsForSync — returns assignments with due dates for push to GCal
// Called from the /api/google-calendar/sync route handler via fetchQuery.
// Must be a public query (not internalQuery) so it can be called with a
// Clerk session token from a Next.js route handler.
// ---------------------------------------------------------------------------

export const getAssignmentsForSync = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Only push incomplete assignments that have a due date
    const pushable = assignments.filter((a) => !a.isCompleted && a.dueAt !== undefined);

    // Fetch course names for event titles
    const courseIds = [...new Set(pushable.map((a) => a.courseId))];
    const courseMap = new Map<string, string>();
    for (const courseId of courseIds) {
      const course = await ctx.db.get(courseId);
      if (course) courseMap.set(courseId, course.courseCode || course.name);
    }

    return pushable.map((a) => ({
      _id: a._id,
      title: a.title,
      dueAt: a.dueAt!,
      courseCode: courseMap.get(a.courseId) ?? "",
      htmlUrl: a.htmlUrl,
      googleCalendarEventId: a.googleCalendarEventId,
    }));
  },
});

// ---------------------------------------------------------------------------
// patchAssignmentGcalEventId — stores the Google Calendar event ID on the
// assignment after a successful push
// ---------------------------------------------------------------------------

export const patchAssignmentGcalEventId = mutation({
  args: {
    assignmentId: v.id("assignments"),
    gcalEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify the assignment belongs to the requesting user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || assignment.userId !== user._id) {
      throw new Error("Assignment not found or unauthorized");
    }

    await ctx.db.patch(args.assignmentId, { googleCalendarEventId: args.gcalEventId });
  },
});

// ---------------------------------------------------------------------------
// upsertGcalEvent — upserts a Google Calendar event into the events table
// with source: "google_calendar"
// Must be a public mutation so it can be called from the sync route handler.
// ---------------------------------------------------------------------------

export const upsertGcalEvent = mutation({
  args: {
    externalId: v.string(),
    title: v.string(),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const now = Date.now();

    const existing = await ctx.db
      .query("events")
      .withIndex("by_userId_externalId", (q) =>
        q.eq("userId", user._id).eq("externalId", args.externalId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        startAt: args.startAt,
        endAt: args.endAt,
        location: args.location,
        lastSyncedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("events", {
      userId: user._id,
      title: args.title,
      startAt: args.startAt,
      endAt: args.endAt,
      location: args.location,
      eventType: "other",
      externalId: args.externalId,
      source: "google_calendar",
      lastSyncedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// updateCalendarSyncStatus — records sync outcome on the user row.
// Must be a public mutation so it can be called from the sync route handler.
// On success, explicitly writes "" to lastCalendarSyncError to clear any
// prior error (Convex db.patch silently omits undefined values, so passing
// undefined would leave a stale error string in place).
// ---------------------------------------------------------------------------

export const updateCalendarSyncStatus = mutation({
  args: {
    status: v.union(v.literal("success"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      lastCalendarSyncAt: Date.now(),
      lastCalendarSyncStatus: args.status,
      // Explicitly write "" on success to clear any prior error string.
      lastCalendarSyncError: args.status === "success" ? "" : args.error,
    });
  },
});

// ---------------------------------------------------------------------------
// removeStaleGcalEvents — deletes pulled Google Calendar events that were
// not present in the most recent sync window, preventing stale data from
// accumulating when the user deletes events from Google Calendar.
// Must be a public mutation so it can be called from the sync route handler.
// ---------------------------------------------------------------------------

export const removeStaleGcalEvents = mutation({
  args: {
    keepExternalIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("events")
      .withIndex("by_userId_source", (q) =>
        q.eq("userId", user._id).eq("source", "google_calendar")
      )
      .collect();

    const keepSet = new Set(args.keepExternalIds);
    for (const event of existing) {
      if (event.externalId && !keepSet.has(event.externalId)) {
        await ctx.db.delete(event._id);
      }
    }
  },
});
