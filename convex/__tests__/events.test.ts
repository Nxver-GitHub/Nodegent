import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const IDENTITY = { subject: "clerk_1", email: "test@ucsc.edu", name: "Test Student" };

async function seedUser(t: ReturnType<typeof convexTest>) {
  await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
}

describe("events", () => {
  describe("getEvents", () => {
    it("returns empty array when unauthenticated", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      const result = await t.query(api.events.getEvents, { startAt: now, endAt: now + 86400000 });
      expect(result).toEqual([]);
    });

    it("returns only events within the time range", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      const now = Date.now();

      await t.withIdentity(IDENTITY).mutation(api.events.upsertEvent, {
        title: "Lecture",
        startAt: now + 3600000,
        eventType: "class",
      });
      await t.withIdentity(IDENTITY).mutation(api.events.upsertEvent, {
        title: "Next Week Exam",
        startAt: now + 8 * 86400000,
        eventType: "exam",
      });

      const events = await t.withIdentity(IDENTITY).query(api.events.getEvents, {
        startAt: now,
        endAt: now + 86400000,
      });

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("Lecture");
    });
  });

  describe("getTodayEvents", () => {
    it("returns empty array when unauthenticated", async () => {
      const t = convexTest(schema);
      const result = await t.query(api.events.getTodayEvents, {});
      expect(result).toEqual([]);
    });

    it("returns events starting today", async () => {
      const t = convexTest(schema);
      await seedUser(t);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const midDay = startOfDay + 12 * 3600000;

      await t.withIdentity(IDENTITY).mutation(api.events.upsertEvent, {
        title: "Today's Lecture",
        startAt: midDay,
        eventType: "class",
      });

      const events = await t.withIdentity(IDENTITY).query(api.events.getTodayEvents, {});
      expect(events.find((e) => e.title === "Today's Lecture")).toBeDefined();
    });
  });

  describe("upsertEvent", () => {
    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await expect(
        t.mutation(api.events.upsertEvent, {
          title: "Lecture",
          startAt: Date.now(),
          eventType: "class",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("updates an existing event when externalId matches", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      const now = Date.now();

      await t.withIdentity(IDENTITY).mutation(api.events.upsertEvent, {
        title: "Original",
        startAt: now,
        eventType: "class",
        externalId: "ext_1",
      });

      await t.withIdentity(IDENTITY).mutation(api.events.upsertEvent, {
        title: "Updated",
        startAt: now + 3600000,
        eventType: "class",
        externalId: "ext_1",
      });

      const events = await t.withIdentity(IDENTITY).query(api.events.getEvents, {
        startAt: now - 1000,
        endAt: now + 7200000,
      });

      const matches = events.filter((e) => e.externalId === "ext_1");
      expect(matches).toHaveLength(1);
      expect(matches[0].title).toBe("Updated");
    });

    it("inserts a new event when no externalId is provided", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      const now = Date.now();

      await t.withIdentity(IDENTITY).mutation(api.events.upsertEvent, {
        title: "Event A",
        startAt: now + 1000,
        eventType: "other",
      });
      await t.withIdentity(IDENTITY).mutation(api.events.upsertEvent, {
        title: "Event B",
        startAt: now + 2000,
        eventType: "other",
      });

      const events = await t.withIdentity(IDENTITY).query(api.events.getEvents, {
        startAt: now,
        endAt: now + 10000,
      });
      expect(events).toHaveLength(2);
    });
  });
});
