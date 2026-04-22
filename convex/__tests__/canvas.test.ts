import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const IDENTITY = { subject: "clerk_1", email: "test@ucsc.edu", name: "Test Student" };
const OTHER_IDENTITY = { subject: "clerk_2", email: "other@ucsc.edu", name: "Other Student" };

async function seedUser(t: ReturnType<typeof convexTest>) {
  await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
}

/** Insert a fake credentials row directly so tests don't depend on encryption. */
async function seedCredentials(t: ReturnType<typeof convexTest>) {
  await seedUser(t);
  await t.run(async (ctx) => {
    // Use filter instead of withIndex — convex-test's t.run ctx doesn't expose named indexes
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), "clerk_1"))
      .first();
    if (!user) throw new Error("User not seeded");
    await ctx.db.insert("canvasCredentials", {
      userId: user._id,
      // Fake cookie JSON — sufficient for testing connection detection logic
      canvasCookies: JSON.stringify([{ name: "canvas_session", value: "fake_value" }]),
      canvasBaseUrl: "https://canvas.ucsc.edu",
    });
  });
}

describe("canvas", () => {
  // ---------------------------------------------------------------------------
  // getCanvasStatus
  // ---------------------------------------------------------------------------

  describe("getCanvasStatus", () => {
    it("returns null when unauthenticated", async () => {
      const t = convexTest(schema);
      const result = await t.query(api.canvas.getCanvasStatus, {});
      expect(result).toBeNull();
    });

    it("returns null when no credentials are saved", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      const result = await t
        .withIdentity(IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      expect(result).toBeNull();
    });

    it("returns status with isConnected: true when credentials exist", async () => {
      const t = convexTest(schema);
      await seedCredentials(t);
      const status = await t
        .withIdentity(IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      expect(status).not.toBeNull();
      expect(status?.isConnected).toBe(true);
    });

    it("returns the hardcoded Canvas base URL", async () => {
      const t = convexTest(schema);
      await seedCredentials(t);
      const status = await t
        .withIdentity(IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      expect(status?.canvasBaseUrl).toBe("https://canvas.ucsc.edu");
    });

    it("never exposes canvasCookies or accessToken to the client", async () => {
      const t = convexTest(schema);
      await seedCredentials(t);
      const status = await t
        .withIdentity(IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      expect(status).not.toHaveProperty("canvasCookies");
      expect(status).not.toHaveProperty("accessToken");
    });

    it("does not return another user's status", async () => {
      const t = convexTest(schema);
      await seedCredentials(t); // seeds clerk_1
      await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
      const otherStatus = await t
        .withIdentity(OTHER_IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      expect(otherStatus).toBeNull();
    });

    it("returns isConnected: false when only legacy accessToken is present", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("clerkId"), "clerk_1"))
          .first();
        if (!user) throw new Error("User not seeded");
        await ctx.db.insert("canvasCredentials", {
          userId: user._id,
          accessToken: "legacy_pat_token",  // old format — no canvasCookies
          canvasBaseUrl: "https://canvas.ucsc.edu",
        });
      });
      const status = await t
        .withIdentity(IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      // isConnected should be false because canvasCookies is not present
      expect(status?.isConnected).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // removeCanvasCredentials
  // ---------------------------------------------------------------------------

  describe("removeCanvasCredentials", () => {
    it("removes saved credentials", async () => {
      const t = convexTest(schema);
      await seedCredentials(t);
      await t
        .withIdentity(IDENTITY)
        .mutation(api.canvas.removeCanvasCredentials, {});
      const status = await t
        .withIdentity(IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      expect(status).toBeNull();
    });

    it("is a no-op when no credentials exist", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await expect(
        t.withIdentity(IDENTITY).mutation(api.canvas.removeCanvasCredentials, {})
      ).resolves.not.toThrow();
    });

    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await expect(
        t.mutation(api.canvas.removeCanvasCredentials, {})
      ).rejects.toThrow("Not authenticated");
    });

    it("only removes the requesting user's credentials", async () => {
      const t = convexTest(schema);
      await seedCredentials(t); // seeds clerk_1
      await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
      // Remove OTHER user's credentials (which don't exist — no-op)
      await t
        .withIdentity(OTHER_IDENTITY)
        .mutation(api.canvas.removeCanvasCredentials, {});
      // clerk_1 credentials should be unchanged
      const status = await t
        .withIdentity(IDENTITY)
        .query(api.canvas.getCanvasStatus, {});
      expect(status?.isConnected).toBe(true);
    });
  });
});
