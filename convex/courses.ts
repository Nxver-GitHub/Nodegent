import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getCourses = query({
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

    return await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getCourseSummaries = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const summaries = await Promise.all(
      courses.map(async (course) => {
        const assignments = await ctx.db
          .query("assignments")
          .withIndex("by_userId_courseId", (q) =>
            q.eq("userId", user._id).eq("courseId", course._id)
          )
          .collect();

        const pending = assignments.filter((a) => !a.isCompleted);
        const nextDueAt = pending
          .filter((a) => a.dueAt !== undefined)
          .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0]?.dueAt;

        return {
          _id: course._id,
          courseCode: course.courseCode,
          name: course.name,
          pendingCount: pending.length,
          nextDueAt,
        };
      })
    );

    return summaries.sort((a, b) => {
      const aDate = a.nextDueAt ?? Number.MAX_SAFE_INTEGER;
      const bDate = b.nextDueAt ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
  },
});

export const upsertCourse = mutation({
  args: {
    canvasId: v.string(),
    name: v.string(),
    courseCode: v.string(),
    term: v.string(),
    instructorName: v.optional(v.string()),
    syllabusUrl: v.optional(v.string()),
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
      .query("courses")
      .withIndex("by_userId_canvasId", (q) =>
        q.eq("userId", user._id).eq("canvasId", args.canvasId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        courseCode: args.courseCode,
        term: args.term,
        instructorName: args.instructorName,
        syllabusUrl: args.syllabusUrl,
        lastSyncedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("courses", {
      userId: user._id,
      canvasId: args.canvasId,
      name: args.name,
      courseCode: args.courseCode,
      term: args.term,
      instructorName: args.instructorName,
      syllabusUrl: args.syllabusUrl,
      lastSyncedAt: now,
    });
  },
});
