import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const IDENTITY = { subject: "clerk_audit_1", email: "audit@ucsc.edu", name: "Audit User" };
const OTHER_IDENTITY = { subject: "clerk_audit_2", email: "other@ucsc.edu", name: "Other User" };

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
}

describe("auditLog (US-4.1)", () => {
  it("getAuditLog returns [] when unauthenticated", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.auditLog.getAuditLog, {});
    expect(result).toEqual([]);
  });

  it("getAuditLog returns [] when user has no log entries", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const result = await t.withIdentity(IDENTITY).query(api.auditLog.getAuditLog, {});
    expect(result).toEqual([]);
  });

  it("logCalendarSync writes an entry visible via getAuditLog", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    await t.withIdentity(IDENTITY).mutation(api.auditLog.logCalendarSync, {
      status: "success",
      details: JSON.stringify({ eventsPushed: 3, eventsPulled: 1 }),
    });
    const log = await t.withIdentity(IDENTITY).query(api.auditLog.getAuditLog, {});
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe("calendar_sync");
    expect(log[0].status).toBe("success");
  });

  it("getAuditLog returns entries newest-first", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    for (let i = 0; i < 3; i++) {
      await t.withIdentity(IDENTITY).mutation(api.auditLog.logCalendarSync, { status: "success" });
    }
    const log = await t.withIdentity(IDENTITY).query(api.auditLog.getAuditLog, {});
    expect(log.length).toBe(3);
    expect(log[0].timestamp).toBeGreaterThanOrEqual(log[1].timestamp);
  });

  it("user A cannot see user B's log entries", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
    await t.withIdentity(IDENTITY).mutation(api.auditLog.logCalendarSync, { status: "success" });
    const otherLog = await t.withIdentity(OTHER_IDENTITY).query(api.auditLog.getAuditLog, {});
    expect(otherLog).toHaveLength(0);
  });

  it("access_toggle audit entry written when toggle changes", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    await t.withIdentity(IDENTITY).mutation(api.users.updateAccessToggles, { canvasEnabled: false });
    const log = await t.withIdentity(IDENTITY).query(api.auditLog.getAuditLog, {});
    expect(log.some((e) => e.action === "access_toggle")).toBe(true);
  });

  it("logCalendarSync is a no-op when unauthenticated", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.auditLog.logCalendarSync, { status: "success" })
    ).resolves.not.toThrow();
  });
});
