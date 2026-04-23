import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

    // Fetch all incomplete assignments for the user, then filter/sort in memory.
    // Convex does not support compound inequality + equality filters on composite indexes,
    // so we pull by userId and filter dueAt on the application side.
    const all = await ctx.db
      .query("assignments")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return all
      .filter((a) => !a.isCompleted && (a.dueAt === undefined || a.dueAt >= now))
      .sort((a, b) => {
        // Undated assignments sort to the end
        const aDate = a.dueAt ?? Number.MAX_SAFE_INTEGER;
        const bDate = b.dueAt ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
  },
});

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
      });
      return existing._id;
    }

    return await ctx.db.insert("assignments", {
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
    });
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

    const all = await ctx.db
      .query("assignments")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const incomplete = all.filter((a) => !a.isCompleted);

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
  },
});
