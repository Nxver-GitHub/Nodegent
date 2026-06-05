import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";

const IDENTITY = { subject: "clerk_S", email: "s@ucsc.edu", name: "Streak User" };

async function seedUserCourseAssignment(t: ReturnType<typeof convexTest>): Promise<{
  userId: Id<"users">;
  assignmentIds: Id<"assignments">[];
}> {
  await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
  await t.withIdentity(IDENTITY).mutation(api.courses.upsertCourse, {
    canvasId: "canvas_1",
    name: "Test Course",
    courseCode: "CSE 115",
    term: "Spring 2026",
  });
  const courses = await t
    .withIdentity(IDENTITY)
    .query(api.courses.getCourses, {});
  const courseId = courses[0]._id;

  const userDoc = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
  if (!userDoc) throw new Error("test setup failed: user not loaded");
  const userId = userDoc._id;

  // Insert assignments directly via the test runner because the public
  // upsertAssignment mutation is sync-only. We need an isCompleted=false row.
  const assignmentIds = await t.run(async (ctx) => {
    const ids: Id<"assignments">[] = [];
    for (let i = 0; i < 3; i += 1) {
      const id = await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: `assn_${i}`,
        title: `Assignment ${i}`,
        isCompleted: false,
        lastSyncedAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  });

  return { userId, assignmentIds };
}

async function readUserRaw(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
) {
  return await t.run(async (ctx) => ctx.db.get(userId));
}

async function setUserStreakState(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  patch: {
    currentStreak?: number;
    longestStreak?: number;
    lastCompletionDate?: string;
    timezone?: string;
  },
) {
  await t.run(async (ctx) => ctx.db.patch(userId, patch));
}

describe("ensureUser timezone arg", () => {
  it("persists a valid timezone on first call", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {
      timezone: "America/New_York",
    });
    const u = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(u?.timezone).toBe("America/New_York");
  });

  it("ignores an invalid timezone", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {
      timezone: "Not/A/Zone",
    });
    const u = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(u?.timezone).toBeUndefined();
  });

  it("updates timezone outside the sync cooldown window", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {
      timezone: "America/New_York",
    });
    // Same session, second call with different valid tz — should patch
    // despite cooldown because tz changed.
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {
      timezone: "Europe/London",
    });
    const u = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(u?.timezone).toBe("Europe/London");
  });
});

describe("markComplete streak side effects", () => {
  it("first-ever false→true completion sets current=1, longest=1, lastCompletionDate=today", async () => {
    const t = convexTest(schema);
    const { userId, assignmentIds } = await seedUserCourseAssignment(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: true,
    });

    const raw = await readUserRaw(t, userId);
    expect(raw?.currentStreak).toBe(1);
    expect(raw?.longestStreak).toBe(1);
    expect(typeof raw?.lastCompletionDate).toBe("string");
    expect(raw?.lastCompletionDate?.length).toBe(10); // YYYY-MM-DD
  });

  it("same-day second completion does not change streak fields", async () => {
    const t = convexTest(schema);
    const { userId, assignmentIds } = await seedUserCourseAssignment(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: true,
    });
    const after1 = await readUserRaw(t, userId);

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[1],
      isCompleted: true,
    });
    const after2 = await readUserRaw(t, userId);

    expect(after2?.currentStreak).toBe(after1?.currentStreak);
    expect(after2?.longestStreak).toBe(after1?.longestStreak);
    expect(after2?.lastCompletionDate).toBe(after1?.lastCompletionDate);
  });

  it("consecutive day increments current and updates longest", async () => {
    const t = convexTest(schema);
    const { userId, assignmentIds } = await seedUserCourseAssignment(t);

    // Seed yesterday's streak state directly so today's transition is
    // deterministic regardless of the wall clock.
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    await setUserStreakState(t, userId, {
      currentStreak: 4,
      longestStreak: 4,
      lastCompletionDate: yesterday,
      timezone: "America/Los_Angeles",
    });

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: true,
    });

    const raw = await readUserRaw(t, userId);
    expect(raw?.currentStreak).toBe(5);
    expect(raw?.longestStreak).toBe(5);
    expect(raw?.lastCompletionDate).toBe(today);
  });

  it("gap day resets current to 1 and preserves longest", async () => {
    const t = convexTest(schema);
    const { userId, assignmentIds } = await seedUserCourseAssignment(t);

    await setUserStreakState(t, userId, {
      currentStreak: 7,
      longestStreak: 7,
      lastCompletionDate: "2020-01-01", // ancient
      timezone: "America/Los_Angeles",
    });

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: true,
    });

    const raw = await readUserRaw(t, userId);
    expect(raw?.currentStreak).toBe(1);
    expect(raw?.longestStreak).toBe(7);
  });

  it("true→false un-completion leaves streak fields untouched", async () => {
    const t = convexTest(schema);
    const { userId, assignmentIds } = await seedUserCourseAssignment(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: true,
    });
    const after1 = await readUserRaw(t, userId);

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: false,
    });
    const after2 = await readUserRaw(t, userId);

    expect(after2?.currentStreak).toBe(after1?.currentStreak);
    expect(after2?.longestStreak).toBe(after1?.longestStreak);
    expect(after2?.lastCompletionDate).toBe(after1?.lastCompletionDate);
  });

  it("re-writing an already-completed assignment is a no-op for streak", async () => {
    const t = convexTest(schema);
    const { userId, assignmentIds } = await seedUserCourseAssignment(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: true,
    });
    const after1 = await readUserRaw(t, userId);

    // Same assignment, same value — no transition.
    await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
      assignmentId: assignmentIds[0],
      isCompleted: true,
    });
    const after2 = await readUserRaw(t, userId);

    expect(after2?.currentStreak).toBe(after1?.currentStreak);
    expect(after2?.lastCompletionDate).toBe(after1?.lastCompletionDate);
  });
});

describe("getCurrentUser displayed streak", () => {
  it("returns stored currentStreak when last is today", async () => {
    const t = convexTest(schema);
    const { userId } = await seedUserCourseAssignment(t);
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    await setUserStreakState(t, userId, {
      currentStreak: 6,
      longestStreak: 9,
      lastCompletionDate: today,
      timezone: "America/Los_Angeles",
    });
    const u = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(u?.currentStreak).toBe(6);
    expect(u?.longestStreak).toBe(9);
  });

  it("returns 0 currentStreak when last is older than yesterday", async () => {
    const t = convexTest(schema);
    const { userId } = await seedUserCourseAssignment(t);
    await setUserStreakState(t, userId, {
      currentStreak: 9,
      longestStreak: 9,
      lastCompletionDate: "2020-01-01",
      timezone: "America/Los_Angeles",
    });
    const u = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(u?.currentStreak).toBe(0);
    // longestStreak stays raw (high-water mark).
    expect(u?.longestStreak).toBe(9);
    // lastCompletionDate stays raw too (useful for a tooltip / debug).
    expect(u?.lastCompletionDate).toBe("2020-01-01");
  });

  it("returns 0 currentStreak when no completion has ever happened", async () => {
    const t = convexTest(schema);
    await seedUserCourseAssignment(t);
    const u = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(u?.currentStreak ?? 0).toBe(0);
  });
});
