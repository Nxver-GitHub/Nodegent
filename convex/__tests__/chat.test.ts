import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { currentUcscTerm } from "../ucscTerm.helpers";

describe("chat (US-3.1)", () => {
  beforeEach(() => {
    process.env.NODEGENT_LLM_MODE = "mock";
  });

  it("sendMessage throws when unauthenticated", async () => {
    const t = convexTest(schema);
    await expect(t.action(api.chat.sendMessage, { content: "hi" })).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("sendMessage creates a default thread and writes user+assistant messages", async () => {
    const t = convexTest(schema);
    const identity = { subject: "clerk_chat_1", email: "c1@ucsc.edu", name: "C1" };

    const userId = await t.withIdentity(identity).mutation(api.users.ensureUser, {});

    const now = Date.now();
    const courseId = await t.run(async (ctx) => {
      return await ctx.db.insert("courses", {
        userId,
        canvasId: "c_1",
        name: "Software Engineering",
        courseCode: "CSE115A",
        // Chat context only includes current-quarter enrollments, so derive
        // the term from the clock rather than hardcoding a quarter.
        term: currentUcscTerm(now).name,
        instructorName: "Instructor",
        lastSyncedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        canvasId: "a_1",
        title: "Sprint 3 deliverable",
        dueAt: now + 2 * 24 * 60 * 60 * 1000,
        pointsPossible: 100,
        submissionType: "online",
        isCompleted: false,
        htmlUrl: "https://canvas.example/assignments/1",
        lastSyncedAt: now,
      });

      await ctx.db.insert("events", {
        userId,
        courseId,
        title: "Lecture",
        startAt: now + 3 * 60 * 60 * 1000,
        endAt: now + 4 * 60 * 60 * 1000,
        location: "Room 101",
        eventType: "class",
        externalId: "e_1",
        lastSyncedAt: now,
      });
    });

    const { threadId } = await t.withIdentity(identity).action(api.chat.sendMessage, {
      content: "What's due this week?",
    });

    const messages = await t.withIdentity(identity).query(api.chat.listMessages, { threadId });
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const userMsg = messages.find((m) => m.role === "user");
    const assistantMsg = messages.find((m) => m.role === "assistant");

    expect(userMsg?.content.toLowerCase()).toContain("due");
    expect(assistantMsg?.content).toBeTruthy();
    expect(assistantMsg?.contextRefs?.length).toBeGreaterThan(0);
  });

  it("listMessages rejects cross-user access", async () => {
    const t = convexTest(schema);
    process.env.NODEGENT_LLM_MODE = "mock";

    const a = { subject: "clerk_a", email: "a@ucsc.edu", name: "A" };
    const b = { subject: "clerk_b", email: "b@ucsc.edu", name: "B" };

    const { threadId } = await t.withIdentity(a).action(api.chat.sendMessage, {
      content: "hello",
    });

    await t.withIdentity(b).mutation(api.users.ensureUser, {});

    await expect(
      t.withIdentity(b).query(api.chat.listMessages, { threadId })
    ).rejects.toThrow("Chat thread not found");
  });

  it("buildCampusContext excludes non-current-term courses and labels enrollments", async () => {
    const t = convexTest(schema);
    const identity = { subject: "clerk_chat_term", email: "term@ucsc.edu", name: "Term" };
    const userId = await t.withIdentity(identity).mutation(api.users.ensureUser, {});

    // Fall 2026 is in session on 2026-10-21.
    const now = Date.parse("2026-10-21T20:00:00Z");
    const { currentId, staleId } = await t.run(async (ctx) => {
      const currentId = await ctx.db.insert("courses", {
        userId,
        canvasId: "c_now",
        name: "Operating Systems",
        courseCode: "CSE-130-01",
        term: "Fall 2026",
        lastSyncedAt: now,
      });
      const staleId = await ctx.db.insert("courses", {
        userId,
        canvasId: "c_old",
        name: "CSE 20 Testout September 2024",
        courseCode: "CSE-20-TESTOUT",
        term: "Fall 2024",
        lastSyncedAt: now,
      });
      await ctx.db.insert("courses", {
        userId,
        canvasId: "c_unknown",
        name: "2024 Slugs CARE, Title IX, & SHOP 2",
        courseCode: "SLUGS-CARE",
        term: "Unknown Term",
        lastSyncedAt: now,
      });
      const dueAt = now + 2 * 24 * 60 * 60 * 1000;
      await ctx.db.insert("assignments", {
        userId,
        courseId: currentId,
        canvasId: "a_now",
        title: "Project 2",
        dueAt,
        isCompleted: false,
        lastSyncedAt: now,
      });
      await ctx.db.insert("assignments", {
        userId,
        courseId: staleId,
        canvasId: "a_old",
        title: "Testout quiz",
        dueAt,
        isCompleted: false,
        lastSyncedAt: now,
      });
      return { currentId, staleId };
    });

    const result = await t.query(internal.chat.buildCampusContext, {
      userId,
      message: "what courses are offered in the fall?",
      now,
    });

    expect(result.contextText).toContain(
      "STUDENT'S OWN CANVAS ENROLLMENTS (Fall 2026) — these are the courses this student is taking, NOT the UCSC course catalog:"
    );
    expect(result.contextText).not.toMatch(/^COURSES:/m);
    expect(result.contextText).toContain("CSE-130-01");
    expect(result.contextText).toContain("Project 2");
    expect(result.contextText).not.toContain("Testout");
    expect(result.contextText).not.toContain("Slugs CARE");

    const refIds = result.contextRefs.map((r) => r.id);
    expect(refIds).toContain(currentId);
    expect(refIds).not.toContain(staleId);
    expect(result.contextRefs.filter((r) => r.type === "course")).toHaveLength(1);
    expect(result.contextRefs.filter((r) => r.type === "assignment")).toHaveLength(1);
    expect(result.stats).toMatchObject({ courses: 1, assignments: 1 });
  });
});

