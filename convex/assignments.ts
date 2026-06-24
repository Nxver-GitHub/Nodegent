import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { recomputeCourseSummary } from "./courses";
import {
  computeNextStreakState,
  dayKey,
  effectiveTimezone,
} from "./streak.helpers";
import { startOfCampusDay } from "./timeUtil";

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

    // Upcoming = incomplete assignments due from now on, plus undated ones. Read
    // via the dueAt index — the future window + the undated bucket — instead of
    // collecting every incomplete row (past-due incompletes accumulate all term
    // and this query re-runs reactively on every Canvas-sync write).
    const [futureDated, undated] = await Promise.all([
      ctx.db
        .query("assignments")
        .withIndex("by_userId_dueAt", (q) =>
          q.eq("userId", user._id).gte("dueAt", now)
        )
        .take(100),
      ctx.db
        .query("assignments")
        .withIndex("by_userId_dueAt", (q) =>
          q.eq("userId", user._id).eq("dueAt", undefined)
        )
        .take(50),
    ]);

    return [...futureDated, ...undated]
      .filter((a) => !a.isCompleted)
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
    dueAt: v.optional(v.number()),
    pointsPossible: v.optional(v.number()),
    submissionType: v.optional(v.string()),
    htmlUrl: v.optional(v.string()),
    skipRecompute: v.optional(v.boolean()),
    submissionStatus: v.optional(v.string()),
    score: v.optional(v.number()),
    letterGrade: v.optional(v.string()),
    hasDescription: v.optional(v.boolean()),
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
      // Skip the write when no synced field actually changed. A no-op patch
      // still bills bandwidth and re-triggers every subscribed assignment
      // query, so re-syncing unchanged data is the main amplifier we cut here.
      // lastSyncedAt is intentionally excluded (it always differs); conditional
      // fields only count as changed when the caller provides a value.
      const unchanged =
        existing.title === args.title &&
        existing.dueAt === args.dueAt &&
        existing.pointsPossible === args.pointsPossible &&
        existing.submissionType === args.submissionType &&
        existing.htmlUrl === args.htmlUrl &&
        (args.submissionStatus === undefined ||
          existing.submissionStatus === args.submissionStatus) &&
        (args.score === undefined || existing.score === args.score) &&
        (args.letterGrade === undefined || existing.letterGrade === args.letterGrade) &&
        (args.hasDescription === undefined || existing.hasDescription === args.hasDescription);

      if (unchanged) {
        // This assignment is identical, so it can't have changed the course
        // summary either — safe to skip the recompute read as well.
        return existing._id;
      }

      await ctx.db.patch(existing._id, {
        title: args.title,
        dueAt: args.dueAt,
        pointsPossible: args.pointsPossible,
        submissionType: args.submissionType,
        htmlUrl: args.htmlUrl,
        lastSyncedAt: now,
        ...(args.submissionStatus !== undefined ? { submissionStatus: args.submissionStatus } : {}),
        ...(args.score !== undefined ? { score: args.score } : {}),
        ...(args.letterGrade !== undefined ? { letterGrade: args.letterGrade } : {}),
        ...(args.hasDescription !== undefined ? { hasDescription: args.hasDescription } : {}),
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
      ...(args.hasDescription !== undefined ? { hasDescription: args.hasDescription } : {}),
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

    const todayStart = startOfCampusDay(Date.now());
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

    const byDue = (a: { dueAt?: number }, b: { dueAt?: number }) =>
      (a.dueAt ?? 0) - (b.dueAt ?? 0);

    // Bounded reads via the dueAt index instead of collecting every incomplete
    // row (past-due incompletes accumulate all term, and this re-runs reactively
    // on every Canvas-sync write). Overdue is capped at the 25 most-recently-due;
    // today/this-week come from one windowed read; undated from its own bucket.
    const [overdueRecent, window, undated] = await Promise.all([
      ctx.db
        .query("assignments")
        .withIndex("by_userId_dueAt", (q) =>
          q.eq("userId", user._id).lt("dueAt", todayStart)
        )
        .order("desc")
        .filter((q) => q.eq(q.field("isCompleted"), false))
        .take(25),
      ctx.db
        .query("assignments")
        .withIndex("by_userId_dueAt", (q) =>
          q.eq("userId", user._id).gte("dueAt", todayStart).lte("dueAt", weekEnd)
        )
        .filter((q) => q.eq(q.field("isCompleted"), false))
        .take(100),
      ctx.db
        .query("assignments")
        .withIndex("by_userId_dueAt", (q) =>
          q.eq("userId", user._id).eq("dueAt", undefined)
        )
        .filter((q) => q.eq(q.field("isCompleted"), false))
        .take(50),
    ]);

    return {
      overdue: overdueRecent.sort(byDue),
      dueToday: window
        .filter((a) => a.dueAt !== undefined && a.dueAt <= todayEnd)
        .sort(byDue),
      dueThisWeek: window
        .filter((a) => a.dueAt !== undefined && a.dueAt > todayEnd)
        .sort(byDue),
      noDueDate: undated,
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

    // US-8.3: bump streak on the false → true transition only. No rollback
    // on true → false (would need per-day completion counts to be correct).
    const isFalseToTrue =
      args.isCompleted === true && assignment.isCompleted === false;

    await ctx.db.patch(args.assignmentId, { isCompleted: args.isCompleted });
    await recomputeCourseSummary(ctx, assignment.courseId);

    if (isFalseToTrue) {
      const tz = effectiveTimezone(user.timezone);
      const todayKey = dayKey(Date.now(), tz);
      const transition = computeNextStreakState(
        {
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          lastCompletionDate: user.lastCompletionDate,
        },
        todayKey,
        tz,
      );
      if (transition.changed) {
        await ctx.db.patch(user._id, {
          currentStreak: transition.next.currentStreak,
          longestStreak: transition.next.longestStreak,
          lastCompletionDate: transition.next.lastCompletionDate,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Assignment descriptions — stored in a separate table so list queries on
// `assignments` never carry the HTML payload. Fetched lazily on card expand.
// ---------------------------------------------------------------------------

export const internalUpsertAssignmentDescription = internalMutation({
  args: {
    userId: v.id("users"),
    assignmentId: v.id("assignments"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("assignmentDescriptions")
      .withIndex("by_assignmentId", (q) => q.eq("assignmentId", args.assignmentId))
      .unique();

    if (existing) {
      if (existing.description === args.description) return;
      await ctx.db.patch(existing._id, {
        description: args.description,
        lastSyncedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("assignmentDescriptions", {
        userId: args.userId,
        assignmentId: args.assignmentId,
        description: args.description,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

export const getAssignmentDescription = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || assignment.userId !== user._id) return null;

    const row = await ctx.db
      .query("assignmentDescriptions")
      .withIndex("by_assignmentId", (q) => q.eq("assignmentId", args.assignmentId))
      .unique();

    return row?.description ?? null;
  },
});
