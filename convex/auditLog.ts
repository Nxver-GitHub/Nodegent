import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ACTION_UNION = v.union(
  v.literal("canvas_sync"),
  v.literal("calendar_sync"),
  v.literal("ai_chat"),
  v.literal("access_toggle"),
  v.literal("canvas_connected"),
  v.literal("canvas_disconnected"),
);

// Internal — called from Convex actions only (syncCanvas, sendMessage, saveCanvasCookies)
export const logAction = internalMutation({
  args: {
    userId: v.id("users"),
    action: ACTION_UNION,
    status: v.union(v.literal("success"), v.literal("error")),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      userId: args.userId,
      action: args.action,
      status: args.status,
      details: args.details,
      timestamp: Date.now(),
    });
  },
});

// Public mutation — callable from Next.js route handlers via fetchMutation
export const logCalendarSync = mutation({
  args: {
    status: v.union(v.literal("success"), v.literal("error")),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return;

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "calendar_sync",
      status: args.status,
      details: args.details,
      timestamp: Date.now(),
    });
  },
});

// Query — returns the 50 most recent audit events for the authenticated user
export const getAuditLog = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("auditLog")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});
