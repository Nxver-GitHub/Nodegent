import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

type GroqBody = { messages: { role: string; content: string }[] };

const groqReply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe("chat → Groq", () => {
  const identity = { subject: "clerk_groq_1", email: "g1@ucsc.edu", name: "G1" };
  let bodies: GroqBody[];

  beforeEach(() => {
    delete process.env.NODEGENT_LLM_MODE;
    process.env.GROQ_API_KEY = "test-key";
    bodies = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GROQ_API_KEY;
  });

  function stubGroq(...responses: (() => Response)[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        const next = responses.shift();
        if (!next) throw new Error("unexpected Groq call");
        return next();
      })
    );
  }

  it("sends the new message once, after prior history", async () => {
    const t = convexTest(schema);
    await t.withIdentity(identity).mutation(api.users.ensureUser, {});
    stubGroq(() => groqReply("first answer"), () => groqReply("second answer"));

    const { threadId } = await t
      .withIdentity(identity)
      .action(api.chat.sendMessage, { content: "first question" });
    await t.withIdentity(identity).action(api.chat.sendMessage, { threadId, content: "second question" });

    const turns = bodies[1].messages.filter((m) => m.role !== "system").map((m) => m.content);
    expect(turns).toEqual(["first question", "first answer", "second question"]);
  });

  it("retries once after a 429 and returns the reply", async () => {
    const t = convexTest(schema);
    await t.withIdentity(identity).mutation(api.users.ensureUser, {});
    stubGroq(
      () => new Response("{}", { status: 429, headers: { "x-ratelimit-reset-tokens": "1ms" } }),
      () => groqReply("after retry")
    );

    const { threadId } = await t.withIdentity(identity).action(api.chat.sendMessage, { content: "hi" });

    const messages = await t.withIdentity(identity).query(api.chat.listMessages, { threadId });
    expect(bodies).toHaveLength(2);
    expect(messages.find((m) => m.role === "assistant")?.content).toBe("after retry");
  });

  it("removes the user's message when no reply could be generated", async () => {
    const t = convexTest(schema);
    await t.withIdentity(identity).mutation(api.users.ensureUser, {});
    stubGroq(
      () => groqReply("first answer"),
      () => new Response("{}", { status: 500 })
    );

    const { threadId } = await t
      .withIdentity(identity)
      .action(api.chat.sendMessage, { content: "first question" });
    await expect(
      t.withIdentity(identity).action(api.chat.sendMessage, { threadId, content: "lost question" })
    ).rejects.toThrow();

    const messages = await t.withIdentity(identity).query(api.chat.listMessages, { threadId });
    expect(messages.map((m) => m.content)).toEqual(["first question", "first answer"]);
  });
});
