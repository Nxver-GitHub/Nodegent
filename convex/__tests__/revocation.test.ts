import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import schema from "../schema";

const IDENTITY = {
  subject: "clerk_revoke_1",
  email: "revoke@ucsc.edu",
  name: "Revoke User",
};

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
}

// ---------------------------------------------------------------------------
// revokeCanvasAccess
// ---------------------------------------------------------------------------

describe("revokeCanvasAccess (US-4.2)", () => {
  it("throws when unauthenticated", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.canvas.revokeCanvasAccess, {})
    ).rejects.toThrow("Not authenticated");
  });

  it("deletes canvasCredentials", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("canvasCredentials", {
        userId,
        canvasCookies: JSON.stringify([{ name: "session", value: "abc" }]),
        canvasBaseUrl: "https://canvas.ucsc.edu",
      });
    });

    await t.withIdentity(IDENTITY).mutation(api.canvas.revokeCanvasAccess, {});

    const creds = await t.run(async (ctx) =>
      ctx.db
        .query("canvasCredentials")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );
    expect(creds).toBeNull();
  });

  it("deletes all courses for the user", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        userId,
        canvasId: "c1",
        name: "Course A",
        courseCode: "A 101",
        term: "Spring 2026",
        lastSyncedAt: now,
      });
      await ctx.db.insert("courses", {
        userId,
        canvasId: "c2",
        name: "Course B",
        courseCode: "B 202",
        term: "Spring 2026",
        lastSyncedAt: now,
      });
    });

    await t.withIdentity(IDENTITY).mutation(api.canvas.revokeCanvasAccess, {});

    const courses = await t.run(async (ctx) =>
      ctx.db
        .query("courses")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(courses).toHaveLength(0);
  });

  it("deletes all assignments for the user", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    await t.run(async (ctx) => {
      const courseId = await ctx.db.insert("courses", {
        userId,
        canvasId: "c_rev1",
        name: "Course Rev",
        courseCode: "REV 100",
        term: "Spring 2026",
        lastSyncedAt: now,
      });
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_rev1",
        title: "Assignment 1",
        isCompleted: false,
        lastSyncedAt: now,
      });
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_rev2",
        title: "Assignment 2",
        isCompleted: true,
        lastSyncedAt: now,
      });
    });

    await t.withIdentity(IDENTITY).mutation(api.canvas.revokeCanvasAccess, {});

    const assignments = await t.run(async (ctx) =>
      ctx.db
        .query("assignments")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(assignments).toHaveLength(0);
  });

  it("is a no-op when nothing is connected", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await expect(
      t.withIdentity(IDENTITY).mutation(api.canvas.revokeCanvasAccess, {})
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// revokeCalendarAccess
// ---------------------------------------------------------------------------

describe("revokeCalendarAccess (US-4.2)", () => {
  it("throws when unauthenticated", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.googleCalendar.revokeCalendarAccess, {})
    ).rejects.toThrow("Not authenticated");
  });

  it("deletes all google_calendar events for the user", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        userId,
        title: "GCal Event 1",
        startAt: now + 3600_000,
        eventType: "other",
        externalId: "gcal:evt1",
        source: "google_calendar",
        lastSyncedAt: now,
      });
      await ctx.db.insert("events", {
        userId,
        title: "GCal Event 2",
        startAt: now + 7200_000,
        eventType: "other",
        externalId: "gcal:evt2",
        source: "google_calendar",
        lastSyncedAt: now,
      });
    });

    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.revokeCalendarAccess, {});

    const remaining = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .withIndex("by_userId_source", (q) =>
          q.eq("userId", userId).eq("source", "google_calendar")
        )
        .collect()
    );
    expect(remaining).toHaveLength(0);
  });

  it("does not delete non-gcal events", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        userId,
        title: "Manual Event",
        startAt: now + 3600_000,
        eventType: "class",
        source: "manual",
        lastSyncedAt: now,
      });
      await ctx.db.insert("events", {
        userId,
        title: "GCal Event",
        startAt: now + 7200_000,
        eventType: "other",
        externalId: "gcal:keep_test",
        source: "google_calendar",
        lastSyncedAt: now,
      });
    });

    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.revokeCalendarAccess, {});

    const allEvents = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(allEvents).toHaveLength(1);
    expect(allEvents[0].title).toBe("Manual Event");
  });

  it("clears calendar sync fields on the user row", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        lastCalendarSyncAt: Date.now(),
        lastCalendarSyncStatus: "success",
        lastCalendarSyncError: "",
      });
    });

    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.revokeCalendarAccess, {});

    const user = await t
      .withIdentity(IDENTITY)
      .query(api.users.getCurrentUser, {});
    expect(user?.lastCalendarSyncAt).toBeUndefined();
    expect(user?.lastCalendarSyncStatus).toBeUndefined();
  });

  it("clears googleCalendarEventId from assignments", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    let assignmentId: Id<"assignments">;
    await t.run(async (ctx) => {
      const courseId = await ctx.db.insert("courses", {
        userId,
        canvasId: "c_gcal_clear",
        name: "GCal Clear Course",
        courseCode: "GCC 100",
        term: "Spring 2026",
        lastSyncedAt: now,
      });
      assignmentId = await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_gcal_clear",
        title: "Assignment With GCal ID",
        isCompleted: false,
        googleCalendarEventId: "gcal_event_abc",
        lastSyncedAt: now,
      });
    });

    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.revokeCalendarAccess, {});

    const assignment = await t.run(async (ctx) =>
      ctx.db.get(assignmentId)
    );
    expect(assignment?.googleCalendarEventId).toBeUndefined();
  });

  it("is a no-op when no calendar data exists", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await expect(
      t
        .withIdentity(IDENTITY)
        .mutation(api.googleCalendar.revokeCalendarAccess, {})
    ).resolves.not.toThrow();
  });
});
