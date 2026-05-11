import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const IDENTITY = {
  subject: "clerk_gcal_1",
  email: "gcal@ucsc.edu",
  name: "GCal User",
};

describe("googleCalendar (US-3.2)", () => {
  beforeEach(() => {
    delete process.env.CONVEX_INTERNAL_SECRET;
  });

  // -------------------------------------------------------------------------
  // getCalendarSyncStatus
  // -------------------------------------------------------------------------

  it("getCalendarSyncStatus returns null when unauthenticated", async () => {
    const t = convexTest(schema);
    const status = await t.query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status).toBeNull();
  });

  it("getCalendarSyncStatus returns no sync fields for a brand-new user", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    const status = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status).not.toBeNull();
    expect(status?.lastCalendarSyncAt).toBeUndefined();
    expect(status?.lastCalendarSyncStatus).toBeUndefined();
    expect(status?.lastCalendarSyncError).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // updateCalendarSyncStatus
  // -------------------------------------------------------------------------

  it("updateCalendarSyncStatus rejects unauthenticated calls", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.googleCalendar.updateCalendarSyncStatus, {
        status: "success",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("updateCalendarSyncStatus records a success sync", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    const before = Date.now();
    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.updateCalendarSyncStatus, {
        status: "success",
      });

    const status = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status?.lastCalendarSyncStatus).toBe("success");
    expect(status?.lastCalendarSyncAt).toBeGreaterThanOrEqual(before);
    expect(status?.lastCalendarSyncError).toBeUndefined();
  });

  it("updateCalendarSyncStatus records an error sync with message", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.updateCalendarSyncStatus, {
        status: "error",
        error: "GOOGLE_AUTH_EXPIRED: token expired",
      });

    const status = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status?.lastCalendarSyncStatus).toBe("error");
    expect(status?.lastCalendarSyncError).toBe("GOOGLE_AUTH_EXPIRED: token expired");
  });

  it("updateCalendarSyncStatus clears the error message when overwriting with success", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.updateCalendarSyncStatus, {
        status: "error",
        error: "some transient failure",
      });
    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.updateCalendarSyncStatus, {
        status: "success",
      });

    const status = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status?.lastCalendarSyncStatus).toBe("success");
    // Error must be cleared — not left as a stale string from the prior error sync
    expect(status?.lastCalendarSyncError).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // upsertGcalEvent
  // -------------------------------------------------------------------------

  it("upsertGcalEvent rejects unauthenticated calls", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.googleCalendar.upsertGcalEvent, {
        externalId: "gcal:abc",
        title: "Team standup",
        startAt: Date.now(),
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("upsertGcalEvent creates a new Google Calendar event", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    const startAt = Date.now();
    await t
      .withIdentity(IDENTITY)
      .mutation(api.googleCalendar.upsertGcalEvent, {
        externalId: "gcal:evt_001",
        title: "Office hours",
        startAt,
        endAt: startAt + 3_600_000,
      });

    const events = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("externalId"), "gcal:evt_001"))
        .collect()
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Office hours");
    expect(events[0].source).toBe("google_calendar");
    expect(events[0].startAt).toBe(startAt);
  });

  // -------------------------------------------------------------------------
  // getAssignmentsForSync
  // -------------------------------------------------------------------------

  it("getAssignmentsForSync rejects unauthenticated calls", async () => {
    const t = convexTest(schema);
    await expect(
      t.query(api.googleCalendar.getAssignmentsForSync, {})
    ).rejects.toThrow("Not authenticated");
  });

  it("getAssignmentsForSync returns only incomplete assignments that have a dueAt", async () => {
    const t = convexTest(schema);
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.ensureUser, {});
    const now = Date.now();

    await t.run(async (ctx) => {
      const courseId = await ctx.db.insert("courses", {
        userId,
        canvasId: "c_1",
        name: "Software Engineering",
        courseCode: "CSE 115A",
        term: "Spring 2026",
        lastSyncedAt: now,
      });

      // Should be included: incomplete + has dueAt
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_include",
        title: "Sprint 3 Deliverable",
        dueAt: now + 7 * 24 * 60 * 60 * 1000,
        isCompleted: false,
        lastSyncedAt: now,
      });

      // Should be excluded: no dueAt
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_no_due",
        title: "TBD Assignment",
        isCompleted: false,
        lastSyncedAt: now,
      });

      // Should be excluded: already completed
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_done",
        title: "Completed Homework",
        dueAt: now - 86_400_000,
        isCompleted: true,
        lastSyncedAt: now,
      });
    });

    const assignments = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getAssignmentsForSync, {});

    expect(assignments).toHaveLength(1);
    expect(assignments[0].title).toBe("Sprint 3 Deliverable");
    expect(assignments[0].dueAt).toBeGreaterThan(now);
  });

  it("getAssignmentsForSync returns empty array for user with no assignments", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    const assignments = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getAssignmentsForSync, {});
    expect(assignments).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // removeStaleGcalEvents
  // -------------------------------------------------------------------------

  describe("removeStaleGcalEvents", () => {
    it("rejects unauthenticated calls", async () => {
      const t = convexTest(schema);
      await expect(
        t.mutation(api.googleCalendar.removeStaleGcalEvents, { keepExternalIds: [] })
      ).rejects.toThrow("Not authenticated");
    });

    it("deletes google_calendar events not in keepExternalIds", async () => {
      const t = convexTest(schema);
      const userId = await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("events", {
          userId,
          title: "Keep me",
          startAt: now,
          eventType: "other",
          externalId: "gcal:keep",
          source: "google_calendar",
          lastSyncedAt: now,
        });
        await ctx.db.insert("events", {
          userId,
          title: "Delete me",
          startAt: now,
          eventType: "other",
          externalId: "gcal:stale",
          source: "google_calendar",
          lastSyncedAt: now,
        });
      });

      await t
        .withIdentity(IDENTITY)
        .mutation(api.googleCalendar.removeStaleGcalEvents, {
          keepExternalIds: ["gcal:keep"],
        });

      const remaining = await t.run(async (ctx) =>
        ctx.db
          .query("events")
          .filter((q) => q.eq(q.field("source"), "google_calendar"))
          .collect()
      );
      expect(remaining).toHaveLength(1);
      expect(remaining[0].externalId).toBe("gcal:keep");
    });

    it("deletes all google_calendar events when keepExternalIds is empty", async () => {
      const t = convexTest(schema);
      const userId = await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("events", {
          userId,
          title: "Event A",
          startAt: now,
          eventType: "other",
          externalId: "gcal:a",
          source: "google_calendar",
          lastSyncedAt: now,
        });
        await ctx.db.insert("events", {
          userId,
          title: "Event B",
          startAt: now,
          eventType: "other",
          externalId: "gcal:b",
          source: "google_calendar",
          lastSyncedAt: now,
        });
      });

      await t
        .withIdentity(IDENTITY)
        .mutation(api.googleCalendar.removeStaleGcalEvents, {
          keepExternalIds: [],
        });

      const remaining = await t.run(async (ctx) =>
        ctx.db
          .query("events")
          .filter((q) => q.eq(q.field("source"), "google_calendar"))
          .collect()
      );
      expect(remaining).toHaveLength(0);
    });

    it("does not affect events from other sources", async () => {
      const t = convexTest(schema);
      const userId = await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
      const now = Date.now();

      await t.run(async (ctx) => {
        // Non-gcal event — should survive
        await ctx.db.insert("events", {
          userId,
          title: "Canvas deadline",
          startAt: now,
          eventType: "other",
          source: "canvas",
          lastSyncedAt: now,
        });
        // GCal event — will be removed
        await ctx.db.insert("events", {
          userId,
          title: "GCal event",
          startAt: now,
          eventType: "other",
          externalId: "gcal:gone",
          source: "google_calendar",
          lastSyncedAt: now,
        });
      });

      await t
        .withIdentity(IDENTITY)
        .mutation(api.googleCalendar.removeStaleGcalEvents, {
          keepExternalIds: [],
        });

      const remaining = await t.run(async (ctx) =>
        ctx.db.query("events").collect()
      );
      expect(remaining).toHaveLength(1);
      expect(remaining[0].source).toBe("canvas");
    });
  });
});
