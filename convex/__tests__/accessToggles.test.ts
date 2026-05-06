import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const SECRET = "test-internal-secret";
const IDENTITY = {
  subject: "clerk_toggle_1",
  email: "toggle@ucsc.edu",
  name: "Toggle User",
};

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
}

// ---------------------------------------------------------------------------
// updateAccessToggles
// ---------------------------------------------------------------------------

describe("updateAccessToggles (US-3.4)", () => {
  beforeEach(() => {
    process.env.CONVEX_INTERNAL_SECRET = SECRET;
  });

  it("throws when unauthenticated", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.users.updateAccessToggles, { canvasEnabled: false })
    ).rejects.toThrow("Not authenticated");
  });

  it("sets canvasEnabled to false", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.updateAccessToggles, { canvasEnabled: false });

    const user = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(user?.canvasEnabled).toBe(false);
  });

  it("sets calendarEnabled to false", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.updateAccessToggles, { calendarEnabled: false });

    const user = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(user?.calendarEnabled).toBe(false);
  });

  it("re-enables canvasEnabled after disabling", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.updateAccessToggles, { canvasEnabled: false });
    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.updateAccessToggles, { canvasEnabled: true });

    const user = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(user?.canvasEnabled).toBe(true);
  });

  it("is a no-op when called with no arguments", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await expect(
      t.withIdentity(IDENTITY).mutation(api.users.updateAccessToggles, {})
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getUserSettingsInternal
// ---------------------------------------------------------------------------

describe("getUserSettingsInternal (US-3.4)", () => {
  beforeEach(() => {
    process.env.CONVEX_INTERNAL_SECRET = SECRET;
  });

  it("throws on wrong secret", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await expect(
      t.query(api.users.getUserSettingsInternal, {
        clerkUserId: IDENTITY.subject,
        internalSecret: "wrong",
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("returns null for unknown user", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.users.getUserSettingsInternal, {
      clerkUserId: "nonexistent",
      internalSecret: SECRET,
    });
    expect(result).toBeNull();
  });

  it("returns toggle settings for existing user", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.updateAccessToggles, { calendarEnabled: false });

    const settings = await t.query(api.users.getUserSettingsInternal, {
      clerkUserId: IDENTITY.subject,
      internalSecret: SECRET,
    });

    expect(settings?.calendarEnabled).toBe(false);
    // canvasEnabled was never set — should be undefined (enabled by default)
    expect(settings?.canvasEnabled).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildCampusContext toggle filtering
// ---------------------------------------------------------------------------

describe("buildCampusContext access toggles (US-3.4)", () => {
  beforeEach(() => {
    process.env.NODEGENT_LLM_MODE = "mock";
    process.env.CONVEX_INTERNAL_SECRET = SECRET;
  });

  it("excludes Canvas courses and assignments from AI context when canvasEnabled is false", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    // Seed a course and assignment
    await t.run(async (ctx) => {
      const courseId = await ctx.db.insert("courses", {
        userId,
        canvasId: "c_toggle_1",
        name: "Test Course",
        courseCode: "TST 101",
        term: "Spring 2026",
        lastSyncedAt: now,
      });
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_toggle_1",
        title: "Secret Assignment",
        dueAt: now + 2 * 24 * 60 * 60 * 1000,
        isCompleted: false,
        lastSyncedAt: now,
      });
    });

    // Disable Canvas
    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.updateAccessToggles, { canvasEnabled: false });

    // sendMessage — AI context should not include Canvas data
    const { threadId } = await t
      .withIdentity(IDENTITY)
      .action(api.chat.sendMessage, { content: "What assignments do I have?" });

    const messages = await t
      .withIdentity(IDENTITY)
      .query(api.chat.listMessages, { threadId });

    const assistant = messages.find((m) => m.role === "assistant");
    // contextRefs should be empty — no Canvas data injected
    expect(assistant?.contextRefs).toHaveLength(0);
  });

  it("excludes Google Calendar events from AI context when calendarEnabled is false", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    // Seed a gcal event
    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        userId,
        title: "Team standup",
        startAt: now + 60 * 60 * 1000,
        endAt: now + 2 * 60 * 60 * 1000,
        eventType: "other",
        externalId: "gcal:test_001",
        source: "google_calendar",
        lastSyncedAt: now,
      });
    });

    // Disable Calendar
    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.updateAccessToggles, { calendarEnabled: false });

    const { threadId } = await t
      .withIdentity(IDENTITY)
      .action(api.chat.sendMessage, { content: "What is on my schedule today?" });

    const messages = await t
      .withIdentity(IDENTITY)
      .query(api.chat.listMessages, { threadId });

    const assistant = messages.find((m) => m.role === "assistant");
    // No event contextRefs should appear
    const eventRefs = (assistant?.contextRefs ?? []).filter((r) => r.type === "event");
    expect(eventRefs).toHaveLength(0);
  });

  it("includes Canvas data in context when toggle is undefined (new user — enabled by default)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.now();

    await t.run(async (ctx) => {
      const courseId = await ctx.db.insert("courses", {
        userId,
        canvasId: "c_default_1",
        name: "Default Course",
        courseCode: "DEF 100",
        term: "Spring 2026",
        lastSyncedAt: now,
      });
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_default_1",
        title: "Visible Assignment",
        dueAt: now + 3 * 24 * 60 * 60 * 1000,
        isCompleted: false,
        lastSyncedAt: now,
      });
    });

    // No toggle set — should default to enabled
    const user = await t.withIdentity(IDENTITY).query(api.users.getCurrentUser, {});
    expect(user?.canvasEnabled).toBeUndefined();

    const { threadId } = await t
      .withIdentity(IDENTITY)
      .action(api.chat.sendMessage, { content: "What assignments are due?" });

    const messages = await t
      .withIdentity(IDENTITY)
      .query(api.chat.listMessages, { threadId });

    const assistant = messages.find((m) => m.role === "assistant");
    const courseRefs = (assistant?.contextRefs ?? []).filter((r) => r.type === "course");
    expect(courseRefs.length).toBeGreaterThan(0);
  });
});
