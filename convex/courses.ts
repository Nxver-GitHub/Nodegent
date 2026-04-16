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
