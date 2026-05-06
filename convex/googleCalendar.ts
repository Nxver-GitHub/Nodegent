import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Auth helper — validates CONVEX_INTERNAL_SECRET for server-to-server calls
// ---------------------------------------------------------------------------

function validateInternalSecret(secret: string): void {
  if (!process.env.CONVEX_INTERNAL_SECRET || secret !== process.env.CONVEX_INTERNAL_SECRET) {
    throw new Error("Unauthorized");
  }
}

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
      lastCalendarSyncError: user.lastCalendarSyncError,
    };
  },
});

// ---------------------------------------------------------------------------
// getAssignmentsForPushInternal — returns assignments with due dates for push
// Called from the /api/google-calendar/sync route handler
// ---------------------------------------------------------------------------

export const getAssignmentsForPushInternal = query({
  args: {
    clerkUserId: v.string(),
    internalSecret: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalSecret(args.internalSecret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
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
    clerkUserId: v.string(),
    internalSecret: v.string(),
    assignmentId: v.id("assignments"),
    gcalEventId: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalSecret(args.internalSecret);

    // Verify the assignment belongs to the requesting user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
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
// upsertGcalEventInternal — upserts a Google Calendar event into the events
// table with source: "google_calendar"
// ---------------------------------------------------------------------------

export const upsertGcalEventInternal = mutation({
  args: {
    clerkUserId: v.string(),
    internalSecret: v.string(),
    externalId: v.string(),
    title: v.string(),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    validateInternalSecret(args.internalSecret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
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
// updateCalendarSyncStatusInternal — records sync outcome on the user row
// ---------------------------------------------------------------------------

export const updateCalendarSyncStatusInternal = mutation({
  args: {
    clerkUserId: v.string(),
    internalSecret: v.string(),
    status: v.union(v.literal("success"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    validateInternalSecret(args.internalSecret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      lastCalendarSyncAt: Date.now(),
      lastCalendarSyncStatus: args.status,
      lastCalendarSyncError: args.error,
    });
  },
});

// ---------------------------------------------------------------------------
// removeStaleGcalEvents — deletes pulled Google Calendar events older than
// the sync window so stale data doesn't accumulate
// ---------------------------------------------------------------------------

export const removeStaleGcalEventsInternal = internalMutation({
  args: {
    userId: v.id("users"),
    keepExternalIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_userId_source", (q) =>
        q.eq("userId", args.userId).eq("source", "google_calendar")
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
