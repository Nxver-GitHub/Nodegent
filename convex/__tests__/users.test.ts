import { convexTest } from "convex-test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

describe("users", () => {
  describe("ensureUser", () => {
    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await expect(t.mutation(api.users.ensureUser, {})).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("creates a new user on first call", async () => {
      const t = convexTest(schema);
      const userId = await t.withIdentity({ subject: "clerk_1", email: "test@ucsc.edu", name: "Test Student" }).mutation(api.users.ensureUser, {});
      expect(userId).toBeTruthy();

      const user = await t.withIdentity({ subject: "clerk_1", email: "test@ucsc.edu", name: "Test Student" }).query(api.users.getCurrentUser, {});
      expect(user?.clerkId).toBe("clerk_1");
      expect(user?.email).toBe("test@ucsc.edu");
      expect(user?.name).toBe("Test Student");
    });

    it("returns the same id on repeated calls within the cooldown window", async () => {
      const t = convexTest(schema);
      const identity = { subject: "clerk_2", email: "a@ucsc.edu", name: "A" };
      const id1 = await t.withIdentity(identity).mutation(api.users.ensureUser, {});
      const id2 = await t.withIdentity(identity).mutation(api.users.ensureUser, {});
      expect(id1).toEqual(id2);
    });

    it("updates name when it changes in Clerk", async () => {
      const t = convexTest(schema);
      // Create user
      await t.withIdentity({ subject: "clerk_3", email: "b@ucsc.edu", name: "Old Name" }).mutation(api.users.ensureUser, {});

      // Force lastSyncedAt to be old so the cooldown is bypassed
      const user = await t.withIdentity({ subject: "clerk_3", email: "b@ucsc.edu", name: "Old Name" }).query(api.users.getCurrentUser, {});
      await t.run(async (ctx) => {
        await ctx.db.patch(user!._id, { lastSyncedAt: Date.now() - 10 * 60 * 1000 });
      });

      // Call ensureUser with a new name
      await t.withIdentity({ subject: "clerk_3", email: "b@ucsc.edu", name: "New Name" }).mutation(api.users.ensureUser, {});

      const updated = await t.withIdentity({ subject: "clerk_3", email: "b@ucsc.edu", name: "New Name" }).query(api.users.getCurrentUser, {});
      expect(updated?.name).toBe("New Name");
    });
  });

  describe("getCurrentUser", () => {
    it("returns null when unauthenticated", async () => {
      const t = convexTest(schema);
      const user = await t.query(api.users.getCurrentUser, {});
      expect(user).toBeNull();
    });

    it("returns null when authenticated but user not yet created", async () => {
      const t = convexTest(schema);
      const user = await t.withIdentity({ subject: "clerk_new", email: "new@ucsc.edu", name: "New" }).query(api.users.getCurrentUser, {});
      expect(user).toBeNull();
    });
  });
});
