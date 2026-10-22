import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import {
  decryptCookies,
  encryptCookies,
  isEncryptedCookies,
} from "../cookieCrypto.helpers";

const SECRET = "test-internal-secret";
// 32 zero bytes, base64 — test-only key.
const TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

const IDENTITY = { subject: "clerk_sec_1", email: "sec@ucsc.edu", name: "Sec User" };
const OTHER = { subject: "clerk_sec_2", email: "other@ucsc.edu", name: "Other User" };

beforeEach(() => {
  process.env.CONVEX_INTERNAL_SECRET = SECRET;
  process.env.CANVAS_COOKIE_KEY = TEST_KEY;
});

afterEach(() => {
  delete process.env.CONVEX_INTERNAL_SECRET;
  delete process.env.CANVAS_COOKIE_KEY;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("internal secret gate", () => {
  it("rejects a wrong secret", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.guards.consumeRateLimit, {
        secret: "wrong",
        bucket: "browse",
        clerkId: "u1",
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects every call when the secret is unset on the deployment", async () => {
    delete process.env.CONVEX_INTERNAL_SECRET;
    const t = convexTest(schema);
    await expect(
      t.query(api.ssoRelay.pendingInputs, { secret: "", clerkId: "u1", sessionId: "s1" })
    ).rejects.toThrow("Unauthorized");
  });
});

describe("guards.consumeRateLimit", () => {
  it("allows up to the bucket limit then returns retryAfterMs", async () => {
    const t = convexTest(schema);
    const args = { secret: SECRET, bucket: "browse" as const, clerkId: "u1" };
    for (let i = 0; i < 10; i++) {
      expect((await t.mutation(api.guards.consumeRateLimit, args)).ok).toBe(true);
    }
    const blocked = await t.mutation(api.guards.consumeRateLimit, args);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps separate windows per user", async () => {
    const t = convexTest(schema);
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.guards.consumeRateLimit, {
        secret: SECRET,
        bucket: "browse",
        clerkId: "u1",
      });
    }
    const other = await t.mutation(api.guards.consumeRateLimit, {
      secret: SECRET,
      bucket: "browse",
      clerkId: "u2",
    });
    expect(other.ok).toBe(true);
  });
});

describe("guards browser leases", () => {
  const lease = (owner: string) => ({
    secret: SECRET,
    kind: "browse" as const,
    owner,
    ttlMs: 60_000,
  });

  it("caps each kind at 5 and the pool at 8", async () => {
    const t = convexTest(schema);
    for (let i = 0; i < 5; i++) {
      const { leaseId } = await t.mutation(api.guards.acquireBrowserLease, lease(`b${i}`));
      expect(leaseId).not.toBeNull();
    }
    // Browse is full, but Canvas login still has headroom.
    expect((await t.mutation(api.guards.acquireBrowserLease, lease("b5"))).leaseId).toBeNull();
    for (let i = 0; i < 3; i++) {
      const sso = { ...lease(`c${i}`), kind: "canvasSso" as const };
      expect((await t.mutation(api.guards.acquireBrowserLease, sso)).leaseId).not.toBeNull();
    }
    const overflow = { ...lease("c3"), kind: "canvasSso" as const };
    expect((await t.mutation(api.guards.acquireBrowserLease, overflow)).leaseId).toBeNull();
  });

  it("caps a single owner at 2 and frees the slot on release", async () => {
    const t = convexTest(schema);
    const a = await t.mutation(api.guards.acquireBrowserLease, lease("same"));
    await t.mutation(api.guards.acquireBrowserLease, lease("same"));
    expect((await t.mutation(api.guards.acquireBrowserLease, lease("same"))).leaseId).toBeNull();

    await t.mutation(api.guards.releaseBrowserLease, { secret: SECRET, leaseId: a.leaseId! });
    expect((await t.mutation(api.guards.acquireBrowserLease, lease("same"))).leaseId).not.toBeNull();
  });

  it("ignores expired leases and prunes them", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema);
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.guards.acquireBrowserLease, { ...lease(`o${i}`), ttlMs: 5_000 });
    }
    vi.advanceTimersByTime(6_000);
    expect((await t.mutation(api.guards.acquireBrowserLease, lease("late"))).leaseId).not.toBeNull();

    await t.mutation(internal.guards.pruneExpired, {});
    const remaining = await t.run((ctx) => ctx.db.query("browserLeases").collect());
    expect(remaining).toHaveLength(1);
  });
});

describe("ssoRelay", () => {
  const click = { kind: "click" as const, x: 10, y: 20, viewportWidth: 960, viewportHeight: 700 };
  const base = { secret: SECRET, clerkId: "u1" };

  it("refuses input when the user has no live session", async () => {
    const t = convexTest(schema);
    expect(await t.mutation(api.ssoRelay.queueInput, { ...base, input: click })).toEqual({
      ok: false,
      reason: "no-session",
    });
  });

  it("delivers queued input once, in order, only to the owning session", async () => {
    const t = convexTest(schema);
    await t.mutation(api.ssoRelay.beginSession, { ...base, sessionId: "s1" });
    await t.mutation(api.ssoRelay.queueInput, { ...base, input: click });
    await t.mutation(api.ssoRelay.queueInput, { ...base, input: { kind: "type", text: "123456" } });

    const ids = await t.query(api.ssoRelay.pendingInputs, { ...base, sessionId: "s1" });
    expect(ids).toHaveLength(2);

    // Another user can't claim u1's rows.
    expect(
      await t.mutation(api.ssoRelay.takeInputs, { secret: SECRET, clerkId: "u2", sessionId: "s1", ids })
    ).toHaveLength(0);

    const taken = await t.mutation(api.ssoRelay.takeInputs, { ...base, sessionId: "s1", ids });
    expect(taken.map((row) => row.kind)).toEqual(["click", "type"]);
    expect(await t.mutation(api.ssoRelay.takeInputs, { ...base, sessionId: "s1", ids })).toHaveLength(0);
  });

  it("routes input to the newest session, not a stale stream", async () => {
    const t = convexTest(schema);
    await t.mutation(api.ssoRelay.beginSession, { ...base, sessionId: "old" });
    await t.mutation(api.ssoRelay.queueInput, { ...base, input: click });
    await t.mutation(api.ssoRelay.beginSession, { ...base, sessionId: "new" });
    await t.mutation(api.ssoRelay.queueInput, { ...base, input: { kind: "type", text: "42" } });

    // The superseded session sees nothing (its leftovers were cleared).
    expect(await t.query(api.ssoRelay.pendingInputs, { ...base, sessionId: "old" })).toHaveLength(0);
    const ids = await t.query(api.ssoRelay.pendingInputs, { ...base, sessionId: "new" });
    expect(await t.mutation(api.ssoRelay.takeInputs, { ...base, sessionId: "old", ids })).toHaveLength(0);
    const taken = await t.mutation(api.ssoRelay.takeInputs, { ...base, sessionId: "new", ids });
    expect(taken.map((row) => row.text)).toEqual(["42"]);

    // Ending the stale session must not tear down the current one.
    await t.mutation(api.ssoRelay.endSession, { ...base, sessionId: "old" });
    expect((await t.mutation(api.ssoRelay.queueInput, { ...base, input: click })).ok).toBe(true);
  });

  it("reports the live session so superseded streams can shut down", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.ssoRelay.currentSession, base)).toBeNull();
    await t.mutation(api.ssoRelay.beginSession, { ...base, sessionId: "first" });
    expect(await t.query(api.ssoRelay.currentSession, base)).toBe("first");
    await t.mutation(api.ssoRelay.beginSession, { ...base, sessionId: "second" });
    expect(await t.query(api.ssoRelay.currentSession, base)).toBe("second");
    await t.mutation(api.ssoRelay.endSession, { ...base, sessionId: "second" });
    expect(await t.query(api.ssoRelay.currentSession, base)).toBeNull();
  });

  it("does not deliver expired input", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema);
    await t.mutation(api.ssoRelay.beginSession, { ...base, sessionId: "s1" });
    await t.mutation(api.ssoRelay.queueInput, { ...base, input: click });
    const ids = await t.query(api.ssoRelay.pendingInputs, { ...base, sessionId: "s1" });
    vi.advanceTimersByTime(3 * 60_000);
    expect(await t.mutation(api.ssoRelay.takeInputs, { ...base, sessionId: "s1", ids })).toHaveLength(0);
  });

  it("refuses input past the per-session backlog cap", async () => {
    const t = convexTest(schema);
    await t.mutation(api.ssoRelay.beginSession, { ...base, sessionId: "s1" });
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.ssoRelay.queueInput, { ...base, input: click });
    }
    expect(await t.mutation(api.ssoRelay.queueInput, { ...base, input: click })).toEqual({
      ok: false,
      reason: "busy",
    });
  });
});

describe("cookie encryption", () => {
  it("round-trips and is bound to the user", async () => {
    const stored = await encryptCookies('[{"name":"a","value":"b"}]', "user_a");
    expect(isEncryptedCookies(stored)).toBe(true);
    expect(stored).not.toContain('"value"');
    expect(await decryptCookies(stored, "user_a")).toBe('[{"name":"a","value":"b"}]');
    await expect(decryptCookies(stored, "user_b")).rejects.toThrow();
  });

  it("passes legacy plaintext through unchanged", async () => {
    expect(await decryptCookies("[]", "user_a")).toBe("[]");
  });

  it("refuses to encrypt without a key", async () => {
    delete process.env.CANVAS_COOKIE_KEY;
    await expect(encryptCookies("[]", "user_a")).rejects.toThrow("CANVAS_COOKIE_KEY");
  });
});

describe("canvas.saveCanvasCookiesFromServer", () => {
  const cookies = [
    { name: "canvas_session", value: "s1", domain: "canvas.ucsc.edu", path: "/", httpOnly: true },
    { name: "edu_wide", value: "s2", domain: ".ucsc.edu", path: "/" },
    { name: "duo_state", value: "x", domain: "api-abc.duosecurity.com", path: "/" },
    { name: "sso", value: "y", domain: "login.ucsc.edu", path: "/" },
  ];

  it("stores only Canvas-bound cookies, encrypted", async () => {
    const t = convexTest(schema);
    const userId = await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});

    await t.action(api.canvas.saveCanvasCookiesFromServer, {
      secret: SECRET,
      clerkId: IDENTITY.subject,
      cookiesJson: JSON.stringify(cookies),
    });

    const creds = await t.run((ctx) =>
      ctx.db
        .query("canvasCredentials")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
    );
    expect(isEncryptedCookies(creds!.canvasCookies!)).toBe(true);
    const stored = JSON.parse(await decryptCookies(creds!.canvasCookies!, userId));
    expect(stored.map((c: { name: string }) => c.name)).toEqual(["canvas_session", "edu_wide"]);
    expect(stored[0]).not.toHaveProperty("httpOnly");
  });

  it("rejects a wrong secret", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    await expect(
      t.action(api.canvas.saveCanvasCookiesFromServer, {
        secret: "nope",
        clerkId: IDENTITY.subject,
        cookiesJson: JSON.stringify(cookies),
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects a payload with no Canvas cookies", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    await expect(
      t.action(api.canvas.saveCanvasCookiesFromServer, {
        secret: SECRET,
        clerkId: IDENTITY.subject,
        cookiesJson: JSON.stringify([cookies[2]]),
      })
    ).rejects.toThrow("No Canvas session cookies");
  });
});

describe("canvasCookieMigration.encryptLegacyCookies", () => {
  it("encrypts plaintext rows and is idempotent", async () => {
    const t = convexTest(schema);
    const userId = await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    const plaintext = JSON.stringify([{ name: "canvas_session", value: "legacy" }]);
    await t.run((ctx) =>
      ctx.db.insert("canvasCredentials", { userId, canvasCookies: plaintext })
    );

    expect(await t.action(internal.canvasCookieMigration.encryptLegacyCookies, {})).toEqual({
      encrypted: 1,
      skipped: 0,
    });
    const row = await t.run((ctx) => ctx.db.query("canvasCredentials").first());
    expect(await decryptCookies(row!.canvasCookies!, userId)).toBe(plaintext);

    expect(await t.action(internal.canvasCookieMigration.encryptLegacyCookies, {})).toEqual({
      encrypted: 0,
      skipped: 0,
    });
  });
});

describe("canvas.extractOfficeHours ownership", () => {
  it("never fetches Canvas for a course the caller doesn't own", async () => {
    const t = convexTest(schema);
    await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
    const otherId = await t.withIdentity(OTHER).mutation(api.users.ensureUser, {});
    const courseId = await t.run((ctx) =>
      ctx.db.insert("courses", {
        userId: otherId,
        canvasId: "12345",
        name: "Other's course",
        courseCode: "CSE 101",
        term: "Fall 2026",
        lastSyncedAt: Date.now(),
      })
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await t.withIdentity(IDENTITY).action(api.canvas.extractOfficeHours, {
      courseId,
      canvasId: "../../users/self",
    });
    expect(result).toEqual({ professor: null, tas: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
