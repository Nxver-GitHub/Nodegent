import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const SECRET = "test-internal-secret";
const IDENTITY = {
  subject: "clerk_gcal_1",
  email: "gcal@ucsc.edu",
  name: "GCal User",
};

describe("googleCalendar (US-3.2)", () => {
  beforeEach(() => {
    process.env.CONVEX_INTERNAL_SECRET = SECRET;
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
  // updateCalendarSyncStatusInternal
  // -------------------------------------------------------------------------

  it("updateCalendarSyncStatusInternal rejects wrong secret", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    await expect(
      t.mutation(api.googleCalendar.updateCalendarSyncStatusInternal, {
        clerkUserId: IDENTITY.subject,
        internalSecret: "wrong-secret",
        status: "success",
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("updateCalendarSyncStatusInternal records a success sync", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    const before = Date.now();
    await t.mutation(api.googleCalendar.updateCalendarSyncStatusInternal, {
      clerkUserId: IDENTITY.subject,
      internalSecret: SECRET,
      status: "success",
    });

    const status = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status?.lastCalendarSyncStatus).toBe("success");
    expect(status?.lastCalendarSyncAt).toBeGreaterThanOrEqual(before);
    expect(status?.lastCalendarSyncError).toBeUndefined();
  });

  it("updateCalendarSyncStatusInternal records an error sync with message", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    await t.mutation(api.googleCalendar.updateCalendarSyncStatusInternal, {
      clerkUserId: IDENTITY.subject,
      internalSecret: SECRET,
      status: "error",
      error: "GOOGLE_AUTH_EXPIRED: token expired",
    });

    const status = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status?.lastCalendarSyncStatus).toBe("error");
    expect(status?.lastCalendarSyncError).toBe("GOOGLE_AUTH_EXPIRED: token expired");
  });

  it("updateCalendarSyncStatusInternal overwrites a previous error with success", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    await t.mutation(api.googleCalendar.updateCalendarSyncStatusInternal, {
      clerkUserId: IDENTITY.subject,
      internalSecret: SECRET,
      status: "error",
      error: "some transient failure",
    });
    await t.mutation(api.googleCalendar.updateCalendarSyncStatusInternal, {
      clerkUserId: IDENTITY.subject,
      internalSecret: SECRET,
      status: "success",
    });

    const status = await t
      .withIdentity(IDENTITY)
      .query(api.googleCalendar.getCalendarSyncStatus, {});
    expect(status?.lastCalendarSyncStatus).toBe("success");
  });

  // -------------------------------------------------------------------------
  // upsertGcalEventInternal
  // -------------------------------------------------------------------------

  it("upsertGcalEventInternal rejects wrong secret", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    await expect(
      t.mutation(api.googleCalendar.upsertGcalEventInternal, {
        clerkUserId: IDENTITY.subject,
        internalSecret: "bad",
        externalId: "gcal:abc",
        title: "Team standup",
        startAt: Date.now(),
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("upsertGcalEventInternal creates a new Google Calendar event", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    const startAt = Date.now();
    await t.mutation(api.googleCalendar.upsertGcalEventInternal, {
      clerkUserId: IDENTITY.subject,
      internalSecret: SECRET,
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
  // getAssignmentsForPushInternal
  // -------------------------------------------------------------------------

  it("getAssignmentsForPushInternal rejects wrong secret", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    await expect(
      t.query(api.googleCalendar.getAssignmentsForPushInternal, {
        clerkUserId: IDENTITY.subject,
        internalSecret: "bad",
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("getAssignmentsForPushInternal returns only incomplete assignments that have a dueAt", async () => {
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

    const assignments = await t.query(
      api.googleCalendar.getAssignmentsForPushInternal,
      { clerkUserId: IDENTITY.subject, internalSecret: SECRET }
    );

    expect(assignments).toHaveLength(1);
    expect(assignments[0].title).toBe("Sprint 3 Deliverable");
    expect(assignments[0].dueAt).toBeGreaterThan(now);
  });

  it("getAssignmentsForPushInternal returns empty array for user with no assignments", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    const assignments = await t.query(
      api.googleCalendar.getAssignmentsForPushInternal,
      { clerkUserId: IDENTITY.subject, internalSecret: SECRET }
    );
    expect(assignments).toHaveLength(0);
  });
});
