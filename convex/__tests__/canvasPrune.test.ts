import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const IDENTITY = { subject: "clerk_prune", email: "prune@ucsc.edu", name: "Prune Student" };
const OTHER_IDENTITY = { subject: "clerk_prune_other", email: "other@ucsc.edu", name: "Other" };

type T = ReturnType<typeof convexTest>;

interface Seeded {
  userId: Id<"users">;
  otherUserId: Id<"users">;
  keepCourseId: Id<"courses">;
  goneCourseId: Id<"courses">;
  goneAssignmentId: Id<"assignments">;
  otherCourseId: Id<"courses">;
  otherAssignmentId: Id<"assignments">;
}

/**
 * Two users. The syncing user has a course Canvas still returns (canvasId 101)
 * and a stale one it no longer returns (canvasId 999) with an assignment,
 * description, and canvas event. The other user owns a course with the same
 * stale canvasId — pruning must never touch it.
 */
async function seed(t: T): Promise<Seeded> {
  const userId = await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
  const otherUserId = await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
  const now = Date.now();

  return await t.run(async (ctx) => {
    await ctx.db.insert("canvasCredentials", {
      userId,
      canvasCookies: JSON.stringify([{ name: "canvas_session", value: "fake_value" }]),
      canvasBaseUrl: "https://canvas.ucsc.edu",
    });

    const course = (uid: Id<"users">, canvasId: string, name: string) =>
      ctx.db.insert("courses", {
        userId: uid,
        canvasId,
        name,
        courseCode: name,
        term: "Fall 2026",
        lastSyncedAt: now,
      });
    const assignment = (uid: Id<"users">, courseId: Id<"courses">, canvasId: string) =>
      ctx.db.insert("assignments", {
        userId: uid,
        courseId,
        canvasId,
        title: `Assignment ${canvasId}`,
        dueAt: now + 86_400_000,
        isCompleted: false,
        lastSyncedAt: now,
      });

    const keepCourseId = await course(userId, "101", "CSE-130");
    const goneCourseId = await course(userId, "999", "CSE 20 Testout September 2024");
    const goneAssignmentId = await assignment(userId, goneCourseId, "a_gone");
    await ctx.db.insert("assignmentDescriptions", {
      userId,
      assignmentId: goneAssignmentId,
      description: "<p>old</p>",
      lastSyncedAt: now,
    });
    await ctx.db.insert("events", {
      userId,
      courseId: goneCourseId,
      title: "Old lecture",
      startAt: now + 3_600_000,
      eventType: "class",
      source: "canvas",
      lastSyncedAt: now,
    });

    const otherCourseId = await course(otherUserId, "999", "Other's course");
    const otherAssignmentId = await assignment(otherUserId, otherCourseId, "a_other");

    return {
      userId,
      otherUserId,
      keepCourseId,
      goneCourseId,
      goneAssignmentId,
      otherCourseId,
      otherAssignmentId,
    };
  });
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Route Canvas API calls by URL; the fail* flags make specific endpoints 500. */
function stubCanvas(opts: {
  courses: Array<{ id: number; name: string }>;
  failCourses?: boolean;
  failAssignments?: boolean;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/users/self/profile")) return json({ name: "Prune Student" });
      if (url.includes("/api/v1/courses?enrollment_state")) {
        return opts.failCourses
          ? new Response("Internal Server Error", { status: 500 })
          : json(
              opts.courses.map((c) => ({
                ...c,
                course_code: c.name,
                term: { name: "Fall 2026" },
              }))
            );
      }
      if (url.includes("/enrollments")) return json([]);
      if (url.includes("/assignments")) {
        return opts.failAssignments
          ? new Response("Internal Server Error", { status: 500 })
          : json([
              {
                id: 5001,
                name: "Project 1",
                due_at: new Date(Date.now() + 86_400_000).toISOString(),
                points_possible: 10,
                submission_types: ["online_upload"],
              },
            ]);
      }
      if (url.includes("/students/submissions")) return json([]);
      return new Response("Not Found", { status: 404 });
    })
  );
}

describe("syncCanvas pruning", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("removes courses Canvas no longer returns, with their dependents, but not other users' data", async () => {
    const t = convexTest(schema);
    const s = await seed(t);
    stubCanvas({ courses: [{ id: 101, name: "CSE-130" }] });

    await t.withIdentity(IDENTITY).action(api.canvas.syncCanvas, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.get(s.keepCourseId)).not.toBeNull();
      expect(await ctx.db.get(s.goneCourseId)).toBeNull();
      expect(await ctx.db.get(s.goneAssignmentId)).toBeNull();

      const descriptions = await ctx.db.query("assignmentDescriptions").collect();
      expect(descriptions.filter((d) => d.assignmentId === s.goneAssignmentId)).toHaveLength(0);

      const events = await ctx.db.query("events").collect();
      expect(events.filter((e) => e.courseId === s.goneCourseId)).toHaveLength(0);

      // The kept course received the freshly synced assignment.
      const kept = await ctx.db
        .query("assignments")
        .filter((q) => q.eq(q.field("courseId"), s.keepCourseId))
        .collect();
      expect(kept.map((a) => a.title)).toContain("Project 1");

      // Other user's identically-keyed course and assignment are untouched.
      expect(await ctx.db.get(s.otherCourseId)).not.toBeNull();
      expect(await ctx.db.get(s.otherAssignmentId)).not.toBeNull();
    });
  });

  it("does not prune when the course listing fails", async () => {
    const t = convexTest(schema);
    const s = await seed(t);
    stubCanvas({ courses: [{ id: 101, name: "CSE-130" }], failCourses: true });

    await expect(t.withIdentity(IDENTITY).action(api.canvas.syncCanvas, {})).rejects.toThrow();

    await t.run(async (ctx) => {
      expect(await ctx.db.get(s.goneCourseId)).not.toBeNull();
      expect(await ctx.db.get(s.goneAssignmentId)).not.toBeNull();
    });
  });

  it("does not prune when a later per-course fetch fails mid-sync", async () => {
    const t = convexTest(schema);
    const s = await seed(t);
    stubCanvas({ courses: [{ id: 101, name: "CSE-130" }], failAssignments: true });

    await expect(t.withIdentity(IDENTITY).action(api.canvas.syncCanvas, {})).rejects.toThrow();

    await t.run(async (ctx) => {
      expect(await ctx.db.get(s.goneCourseId)).not.toBeNull();
      expect(await ctx.db.get(s.goneAssignmentId)).not.toBeNull();
    });
  });

  it("does not wipe courses when Canvas returns an empty listing", async () => {
    const t = convexTest(schema);
    const s = await seed(t);
    stubCanvas({ courses: [] });

    await t.withIdentity(IDENTITY).action(api.canvas.syncCanvas, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.get(s.keepCourseId)).not.toBeNull();
      expect(await ctx.db.get(s.goneCourseId)).not.toBeNull();
    });
  });

  it("keeps a stale course that has user notes", async () => {
    const t = convexTest(schema);
    const s = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("courseNotes", {
        userId: s.userId,
        courseId: s.goneCourseId,
        content: "Keep my notes",
        updatedAt: Date.now(),
      });
    });
    stubCanvas({ courses: [{ id: 101, name: "CSE-130" }] });

    await t.withIdentity(IDENTITY).action(api.canvas.syncCanvas, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.get(s.goneCourseId)).not.toBeNull();
      expect(await ctx.db.get(s.goneAssignmentId)).not.toBeNull();
    });
  });

  it("prunes a large stale course across scheduled batches without orphans", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema);
    const s = await seed(t);
    const now = Date.now();
    const CHILDREN = 450; // assignments + descriptions + events well past one batch

    await t.run(async (ctx) => {
      for (let i = 0; i < CHILDREN; i++) {
        const assignmentId = await ctx.db.insert("assignments", {
          userId: s.userId,
          courseId: s.goneCourseId,
          canvasId: `bulk_${i}`,
          title: `Bulk ${i}`,
          isCompleted: false,
          lastSyncedAt: now,
        });
        await ctx.db.insert("assignmentDescriptions", {
          userId: s.userId,
          assignmentId,
          description: "<p>bulk</p>",
          lastSyncedAt: now,
        });
        await ctx.db.insert("events", {
          userId: s.userId,
          courseId: s.goneCourseId,
          title: `Bulk event ${i}`,
          startAt: now,
          eventType: "class",
          source: "canvas",
          lastSyncedAt: now,
        });
      }
    });

    const pruned = await t.mutation(internal.canvas.pruneStaleCourses, {
      userId: s.userId,
      keepCanvasIds: ["101"],
    });
    expect(pruned).toBe(1);

    // First batch is bounded: the course and some dependents remain.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(s.goneCourseId)).not.toBeNull();
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await t.run(async (ctx) => {
      expect(await ctx.db.get(s.goneCourseId)).toBeNull();
      expect(await ctx.db.get(s.keepCourseId)).not.toBeNull();

      const assignments = await ctx.db.query("assignments").collect();
      expect(assignments.filter((a) => a.courseId === s.goneCourseId)).toHaveLength(0);

      const assignmentIds = new Set(assignments.map((a) => a._id as string));
      const descriptions = await ctx.db.query("assignmentDescriptions").collect();
      expect(descriptions.filter((d) => !assignmentIds.has(d.assignmentId))).toHaveLength(0);

      const events = await ctx.db.query("events").collect();
      expect(events.filter((e) => e.courseId === s.goneCourseId)).toHaveLength(0);

      // Other user's identically-keyed course and assignment are untouched.
      expect(await ctx.db.get(s.otherCourseId)).not.toBeNull();
      expect(await ctx.db.get(s.otherAssignmentId)).not.toBeNull();
    });
  });
});
