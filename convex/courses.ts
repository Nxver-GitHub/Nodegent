import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { DatabaseWriter } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export interface TaEntry {
  name: string;
  email?: string;
  officeHours?: string;
}

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

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return courses
      .map((course) => ({
        _id: course._id,
        canvasId: course.canvasId,
        courseCode: course.courseCode,
        name: course.name,
        pendingCount: course.pendingCount ?? 0,
        nextDueAt: course.nextDueAt,
        instructorName: course.instructorName,
        instructorEmail: course.instructorEmail,
        officeHours: course.officeHours,
        tasJson: course.tasJson,
        selectedTaEmail: course.selectedTaEmail,
        calendarSync: course.calendarSync,
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
    instructorEmail: v.optional(v.string()),
    officeHours: v.optional(v.string()),
    tasJson: v.optional(v.string()),
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
      // Merge incoming TA list with existing: preserve officeHours for TAs matched by email
      let mergedTasJson: string | undefined = undefined;
      if (args.tasJson !== undefined) {
        try {
          const existingTas: TaEntry[] = existing.tasJson ? JSON.parse(existing.tasJson) : [];
          const newTas: TaEntry[] = JSON.parse(args.tasJson);
          const merged = newTas.map((ta) => {
            const prev = existingTas.find((e) => e.email && e.email === ta.email);
            return prev?.officeHours ? { ...ta, officeHours: prev.officeHours } : ta;
          });
          mergedTasJson = JSON.stringify(merged);
        } catch {
          mergedTasJson = args.tasJson;
        }
      }
      await ctx.db.patch(existing._id, {
        name: args.name,
        courseCode: args.courseCode,
        term: args.term,
        instructorName: args.instructorName,
        syllabusUrl: args.syllabusUrl,
        instructorEmail: args.instructorEmail,
        // Only overwrite officeHours when the caller explicitly provides a value —
        // prevents Canvas re-sync from clobbering manually-entered or extracted hours.
        ...(args.officeHours !== undefined ? { officeHours: args.officeHours } : {}),
        ...(mergedTasJson !== undefined ? { tasJson: mergedTasJson } : {}),
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
      instructorEmail: args.instructorEmail,
      officeHours: args.officeHours,
      tasJson: args.tasJson,
      lastSyncedAt: now,
      pendingCount: 0,
      nextDueAt: undefined,
    });
  },
});

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

// Update the selected TA for a course.
export const updateSelectedTa = mutation({
  args: {
    courseId: v.id("courses"),
    selectedTaEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) throw new Error("Unauthorized");
    await ctx.db.patch(args.courseId, { selectedTaEmail: args.selectedTaEmail });
  },
});

// Overwrite the full TA list (with merged office hours) for a course.
export const updateTaOfficeHours = mutation({
  args: {
    courseId: v.id("courses"),
    tasJson: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) throw new Error("Unauthorized");
    await ctx.db.patch(args.courseId, { tasJson: args.tasJson });
  },
});

export const updateCourseCalendarSync = mutation({
  args: {
    courseId: v.id("courses"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) throw new Error("Unauthorized");
    await ctx.db.patch(args.courseId, { calendarSync: args.enabled });
  },
});

// Update or clear office hours for a single course.
// This is the canonical write path — upsertCourse (called by Canvas sync)
// deliberately skips this field so syncs never clobber manual/extracted data.
export const updateOfficeHours = mutation({
  args: {
    courseId: v.id("courses"),
    officeHours: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.patch(args.courseId, { officeHours: args.officeHours });
  },
});
