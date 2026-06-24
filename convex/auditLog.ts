import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ACTION_UNION = v.union(
  v.literal("canvas_sync"),
  v.literal("calendar_sync"),
  v.literal("ai_chat"),
  v.literal("access_toggle"),
  v.literal("canvas_connected"),
  v.literal("canvas_disconnected"),
  v.literal("office_hours_viewed"),
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

// Public mutation — called from CourseDetailDrawer when cached office hours are viewed
export const logOfficeHoursViewed = mutation({
  args: {
    courseCode: v.string(),
    source: v.union(v.literal("drawer"), v.literal("extraction")),
    found: v.optional(v.boolean()),
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
      action: "office_hours_viewed",
      status: "success",
      details: JSON.stringify({ courseCode: args.courseCode, source: args.source, found: args.found }),
      timestamp: Date.now(),
    });
  },
});

// Public mutation — called from the study timer overlay after a completed Pomodoro session
export const logPomodoroSession = mutation({
  args: {
    assignmentTitle: v.string(),
    durationSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.assignmentTitle && args.assignmentTitle.length > 500) {
      throw new Error("assignmentTitle too long");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return;

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "ai_chat",
      status: "success",
      details: JSON.stringify({
        type: "pomodoro_session",
        assignmentTitle: args.assignmentTitle,
        durationSeconds: args.durationSeconds,
      }),
      timestamp: Date.now(),
    });
  },
});

// Retention: keep audit entries for this many days. Older rows are pruned daily.
const RETENTION_DAYS = 90;
const PRUNE_BATCH = 500;

// Internal — run by the daily retention cron. Deletes up to PRUNE_BATCH of the
// oldest expired rows per run (steady-state daily volume is far below the batch).
export const pruneOldEntries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expired = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(PRUNE_BATCH);
    await Promise.all(expired.map((e) => ctx.db.delete(e._id)));
    return { deleted: expired.length };
  },
});

// Mutation — deletes all audit log entries for the authenticated user
export const clearAuditLog = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    await Promise.all(entries.map((e) => ctx.db.delete(e._id)));
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
