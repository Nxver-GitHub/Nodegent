import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

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
        term: "Spring 2026",
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
        description: "<p>Build chat</p>",
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
});

