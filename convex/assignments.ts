import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { recomputeCourseSummary } from "./courses";

export const getAssignments = query({
  args: {
    courseId: v.optional(v.id("courses")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return [];
    }

    if (args.courseId) {
      return await ctx.db
        .query("assignments")
        .withIndex("by_userId_courseId", (q) =>
          q.eq("userId", user._id).eq("courseId", args.courseId as Id<"courses">)
        )
        .collect();
    }

    return await ctx.db
      .query("assignments")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getUpcomingAssignments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return [];
    }

    const now = Date.now();

    // Read only incomplete assignments via the dedicated index. Completed ones
    // (often the majority by end of term) never enter the bandwidth tally.
    const incomplete = await ctx.db
      .query("assignments")
      .withIndex("by_userId_isCompleted", (q) =>
        q.eq("userId", user._id).eq("isCompleted", false)
      )
      .collect();

    return incomplete
      .filter((a) => a.dueAt === undefined || a.dueAt >= now)
      .sort((a, b) => {
        // Undated assignments sort to the end
        const aDate = a.dueAt ?? Number.MAX_SAFE_INTEGER;
        const bDate = b.dueAt ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
  },
});

/**
 * Upsert an assignment row.
 *
 * `skipRecompute` lets bulk callers (e.g. `syncCanvas`) defer the course
 * summary update until after a batch of writes completes — call
 * `api.courses.recomputeCourseSummaryPublic` once per affected course at the
 * end of the batch. Default is to recompute on every write so single-shot
 * callers stay correct without extra ceremony.
 */
export const upsertAssignment = mutation({
  args: {
    courseId: v.id("courses"),
    canvasId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    pointsPossible: v.optional(v.number()),
    submissionType: v.optional(v.string()),
    htmlUrl: v.optional(v.string()),
    skipRecompute: v.optional(v.boolean()),
    submissionStatus: v.optional(v.string()),
    score: v.optional(v.number()),
    letterGrade: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("assignments")
      .withIndex("by_userId_canvasId", (q) =>
        q.eq("userId", user._id).eq("canvasId", args.canvasId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        description: args.description,
        dueAt: args.dueAt,
        pointsPossible: args.pointsPossible,
        submissionType: args.submissionType,
        htmlUrl: args.htmlUrl,
        lastSyncedAt: now,
        ...(args.submissionStatus !== undefined ? { submissionStatus: args.submissionStatus } : {}),
        ...(args.score !== undefined ? { score: args.score } : {}),
        ...(args.letterGrade !== undefined ? { letterGrade: args.letterGrade } : {}),
      });
      if (!args.skipRecompute) {
        await recomputeCourseSummary(ctx, args.courseId);
      }
      return existing._id;
    }

    const inserted = await ctx.db.insert("assignments", {
      userId: user._id,
      courseId: args.courseId,
      canvasId: args.canvasId,
      title: args.title,
      description: args.description,
      dueAt: args.dueAt,
      pointsPossible: args.pointsPossible,
      submissionType: args.submissionType,
      isCompleted: false,
      htmlUrl: args.htmlUrl,
      lastSyncedAt: now,
      isNew: true,
      ...(args.submissionStatus !== undefined ? { submissionStatus: args.submissionStatus } : {}),
      ...(args.score !== undefined ? { score: args.score } : {}),
      ...(args.letterGrade !== undefined ? { letterGrade: args.letterGrade } : {}),
    });
    if (!args.skipRecompute) {
      await recomputeCourseSummary(ctx, args.courseId);
    }
    return inserted;
  },
});

export const getDailySnapshot = query({
  args: {},
  handler: async (ctx) => {
    const empty = { overdue: [], dueToday: [], dueThisWeek: [], noDueDate: [] };

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return empty;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return empty;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayStart = startOfToday.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

    // Read only incomplete assignments — completed ones don't appear in any
    // snapshot bucket, so excluding them at the index level saves the read.
    const incomplete = await ctx.db
      .query("assignments")
      .withIndex("by_userId_isCompleted", (q) =>
        q.eq("userId", user._id).eq("isCompleted", false)
      )
      .collect();

    const byDue = (a: { dueAt?: number }, b: { dueAt?: number }) =>
      (a.dueAt ?? 0) - (b.dueAt ?? 0);

    return {
      overdue: incomplete
        .filter((a) => a.dueAt !== undefined && a.dueAt < todayStart)
        .sort(byDue),
      dueToday: incomplete
        .filter((a) => a.dueAt !== undefined && a.dueAt >= todayStart && a.dueAt <= todayEnd)
        .sort(byDue),
      dueThisWeek: incomplete
        .filter((a) => a.dueAt !== undefined && a.dueAt > todayEnd && a.dueAt <= weekEnd)
        .sort(byDue),
      noDueDate: incomplete.filter((a) => a.dueAt === undefined),
    };
  },
});

export const getNewAssignments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    // Respect canvasEnabled toggle — no notifications if Canvas is disabled
    if (user.canvasEnabled === false) return [];

    return await ctx.db
      .query("assignments")
      .withIndex("by_userId_isNew", (q) => q.eq("userId", user._id).eq("isNew", true))
      .collect();
  },
});

export const dismissNewAssignment = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || assignment.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.patch(args.assignmentId, { isNew: false });
  },
});

export const dismissAllNewAssignments = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const newAssignments = await ctx.db
      .query("assignments")
      .withIndex("by_userId_isNew", (q) => q.eq("userId", user._id).eq("isNew", true))
      .collect();

    await Promise.all(newAssignments.map((a) => ctx.db.patch(a._id, { isNew: false })));
  },
});

export const markComplete = mutation({
  args: {
    assignmentId: v.id("assignments"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || assignment.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.assignmentId, { isCompleted: args.isCompleted });
    await recomputeCourseSummary(ctx, assignment.courseId);
  },
});
