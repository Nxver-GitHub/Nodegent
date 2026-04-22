import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const IDENTITY = { subject: "clerk_1", email: "test@ucsc.edu", name: "Test Student" };
const OTHER_IDENTITY = { subject: "clerk_2", email: "other@ucsc.edu", name: "Other Student" };

async function seedUser(t: ReturnType<typeof convexTest>) {
  await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
}

describe("canvas", () => {
  describe("saveCanvasToken", () => {
    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await expect(
        t.mutation(api.canvas.saveCanvasToken, {
          accessToken: "token123",
          canvasBaseUrl: "https://ucsc.instructure.com",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("saves credentials for authenticated user", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "mytoken",
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      const status = await t.withIdentity(IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(status).not.toBeNull();
      expect(status?.canvasBaseUrl).toBe("https://ucsc.instructure.com");
    });

    it("strips trailing slash from canvasBaseUrl", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "tok",
        canvasBaseUrl: "https://ucsc.instructure.com/",
      });
      const status = await t.withIdentity(IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(status?.canvasBaseUrl).toBe("https://ucsc.instructure.com");
    });

    it("rejects non-https canvas URL", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await expect(
        t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
          accessToken: "tok",
          canvasBaseUrl: "http://ucsc.instructure.com",
        })
      ).rejects.toThrow("HTTPS");
    });

    it("rejects empty access token", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await expect(
        t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
          accessToken: "   ",
          canvasBaseUrl: "https://ucsc.instructure.com",
        })
      ).rejects.toThrow("Access token is required");
    });

    it("updates existing credentials instead of inserting a duplicate", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "old_token",
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "new_token",
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      // Verify status still returns (meaning one row exists, not an error from two)
      const status = await t.withIdentity(IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(status).not.toBeNull();
    });
  });

  describe("getCanvasStatus", () => {
    it("returns null when unauthenticated", async () => {
      const t = convexTest(schema);
      const result = await t.query(api.canvas.getCanvasStatus, {});
      expect(result).toBeNull();
    });

    it("returns null when no credentials saved", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      const result = await t.withIdentity(IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(result).toBeNull();
    });

    it("does not include accessToken in returned status", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "secret_token",
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      const status = await t.withIdentity(IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(status).not.toHaveProperty("accessToken");
    });

    it("does not return another user's status", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "tok",
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
      const otherStatus = await t.withIdentity(OTHER_IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(otherStatus).toBeNull();
    });

    it("returns sync status fields after a successful upsert", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "tok",
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      const status = await t.withIdentity(IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(status).toMatchObject({
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      // lastSyncedAt not yet set since no sync has run
      expect(status?.lastSyncedAt).toBeUndefined();
    });
  });

  describe("removeCanvasToken", () => {
    it("removes saved credentials", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await t.withIdentity(IDENTITY).mutation(api.canvas.saveCanvasToken, {
        accessToken: "tok",
        canvasBaseUrl: "https://ucsc.instructure.com",
      });
      await t.withIdentity(IDENTITY).mutation(api.canvas.removeCanvasToken, {});
      const status = await t.withIdentity(IDENTITY).query(api.canvas.getCanvasStatus, {});
      expect(status).toBeNull();
    });

    it("is a no-op when no credentials exist", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      await expect(
        t.withIdentity(IDENTITY).mutation(api.canvas.removeCanvasToken, {})
      ).resolves.not.toThrow();
    });

    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await expect(
        t.mutation(api.canvas.removeCanvasToken, {})
      ).rejects.toThrow("Not authenticated");
    });
  });
});
