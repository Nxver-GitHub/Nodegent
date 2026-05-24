import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { DatabaseWriter } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Recompute and persist the denormalized summary fields for a course.
// Call this from any mutation that creates, updates, completes, or deletes
// an assignment so getCourseSummaries can read summaries directly.
export async function recomputeCourseSummary(
  ctx: { db: DatabaseWriter },
  courseId: Id<"courses">
): Promise<void> {
  const course = await ctx.db.get(courseId);
  if (!course) return;

  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_userId_courseId", (q) =>
      q.eq("userId", course.userId).eq("courseId", courseId)
    )
    .collect();

  const pending = assignments.filter((a) => !a.isCompleted);
  const nextDueAt = pending
    .filter((a) => a.dueAt !== undefined)
    .reduce<number | undefined>(
      (min, a) => (min === undefined || (a.dueAt as number) < min ? a.dueAt : min),
      undefined
    );

  await ctx.db.patch(courseId, {
    pendingCount: pending.length,
    nextDueAt,
  });
}

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

    // Read summaries directly off the courses row — the denormalized fields
    // are kept in sync by recomputeCourseSummary on every assignment write.
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return courses
      .map((course) => ({
        _id: course._id,
        courseCode: course.courseCode,
        name: course.name,
        pendingCount: course.pendingCount ?? 0,
        nextDueAt: course.nextDueAt,
      }))
      .sort((a, b) => {
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
      pendingCount: 0,
      nextDueAt: undefined,
    });
  },
});

// Public wrapper for callers that batch assignment writes with
// `skipRecompute: true` and need to refresh the summary once at the end.
// Enforces ownership before delegating to the helper.
export const recomputeCourseSummaryPublic = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await recomputeCourseSummary(ctx, args.courseId);
  },
});

// One-shot backfill for the new denormalized summary fields. Run once after
// deploying the schema change; safe to re-run (idempotent).
export const backfillCourseSummaries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    for (const course of courses) {
      await recomputeCourseSummary(ctx, course._id);
    }
    return { recomputed: courses.length };
  },
});
