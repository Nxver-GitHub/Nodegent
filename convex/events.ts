import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getEvents = query({
  args: {
    startAt: v.number(),
    endAt: v.number(),
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

    // Fetch all events for user in startAt range using the index
    return await ctx.db
      .query("events")
      .withIndex("by_userId_startAt", (q) =>
        q.eq("userId", user._id).gte("startAt", args.startAt).lte("startAt", args.endAt)
      )
      .collect();
  },
});

export const getTodayEvents = query({
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

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    return await ctx.db
      .query("events")
      .withIndex("by_userId_startAt", (q) =>
        q.eq("userId", user._id).gte("startAt", startOfDay).lte("startAt", endOfDay)
      )
      .collect();
  },
});

export const upsertEvent = mutation({
  args: {
    courseId: v.optional(v.id("courses")),
    title: v.string(),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    location: v.optional(v.string()),
    eventType: v.union(v.literal("class"), v.literal("exam"), v.literal("other")),
    externalId: v.optional(v.string()),
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

    // Attempt upsert by externalId if provided
    if (args.externalId) {
      const existing = await ctx.db
        .query("events")
        .withIndex("by_userId_externalId", (q) =>
          q.eq("userId", user._id).eq("externalId", args.externalId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          courseId: args.courseId,
          title: args.title,
          startAt: args.startAt,
          endAt: args.endAt,
          location: args.location,
          eventType: args.eventType,
          lastSyncedAt: now,
        });
        return existing._id;
      }
    }

    return await ctx.db.insert("events", {
      userId: user._id,
      courseId: args.courseId,
      title: args.title,
      startAt: args.startAt,
      endAt: args.endAt,
      location: args.location,
      eventType: args.eventType,
      externalId: args.externalId,
      lastSyncedAt: now,
    });
  },
});
