import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// ISO week helpers
// ---------------------------------------------------------------------------

/**
 * Returns an ISO-8601 week key like "2026-W23" for a given timestamp.
 * Week starts on Monday per ISO 8601.
 */
function isoWeekKey(ts: number): string {
  const date = new Date(ts);
  // Thursday-based ISO week number
  const thursday = new Date(date);
  thursday.setUTCHours(0, 0, 0, 0);
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Internal query: gather campus context for digest
// ---------------------------------------------------------------------------

export const getDigestContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const now = Date.now();
    const weekEnd = now + 7 * 24 * 60 * 60 * 1000;

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(20);

    const courseById = new Map<string, string>();
    for (const c of courses) {
      courseById.set(c._id, c.courseCode);
    }

    // Overdue: not completed, has a due date in the past
    const overdueAssignments = await ctx.db
      .query("assignments")
      .withIndex("by_userId_isCompleted", (q) =>
        q.eq("userId", args.userId).eq("isCompleted", false)
      )
      .filter((q) => q.lt(q.field("dueAt"), now))
      .take(10);

    // Due this week: not completed, due within the next 7 days
    const upcomingAssignments = await ctx.db
      .query("assignments")
      .withIndex("by_userId_dueAt", (q) =>
        q.eq("userId", args.userId).gte("dueAt", now).lte("dueAt", weekEnd)
      )
      .order("asc")
      .take(15);

    // Upcoming exams (events of type exam) in the next 7 days
    const upcomingExams = await ctx.db
      .query("events")
      .withIndex("by_userId_startAt", (q) =>
        q.eq("userId", args.userId).gte("startAt", now).lte("startAt", weekEnd)
      )
      .filter((q) => q.eq(q.field("eventType"), "exam"))
      .order("asc")
      .take(5);

    const courseNames = courses.map((c) => `${c.courseCode}: ${c.name}`);

    const overdueLines = overdueAssignments.map((a) => {
      const code = courseById.get(a.courseId) ?? "Unknown";
      return `  - [${code}] ${a.title}`;
    });

    const upcomingLines = upcomingAssignments.map((a) => {
      const code = courseById.get(a.courseId) ?? "Unknown";
      const due = a.dueAt
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Los_Angeles",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(a.dueAt))
        : "no date";
      return `  - [${code}] ${a.title} — due ${due}`;
    });

    const examLines = upcomingExams.map((e) => {
      const start = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(e.startAt));
      return `  - ${e.title} — ${start}`;
    });

    const contextText = [
      `Courses enrolled: ${courseNames.join(", ") || "none"}`,
      overdueLines.length > 0
        ? `Overdue assignments (${overdueLines.length}):\n${overdueLines.join("\n")}`
        : "No overdue assignments.",
      upcomingLines.length > 0
        ? `Due this week (${upcomingLines.length}):\n${upcomingLines.join("\n")}`
        : "Nothing due this week.",
      examLines.length > 0
        ? `Upcoming exams (${examLines.length}):\n${examLines.join("\n")}`
        : "No upcoming exams this week.",
    ].join("\n\n");

    return {
      contextText,
      overdueCount: overdueAssignments.length,
      upcomingCount: upcomingAssignments.length,
      examCount: upcomingExams.length,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: persist digest to user record
// ---------------------------------------------------------------------------

export const saveDigest = internalMutation({
  args: {
    userId: v.id("users"),
    digest: v.string(),
    generatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      weeklyDigest: args.digest,
      lastDigestAt: args.generatedAt,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal query: look up user by clerkId
// ---------------------------------------------------------------------------

export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// ---------------------------------------------------------------------------
// Public action: generateWeeklyDigest
// ---------------------------------------------------------------------------

export const generateWeeklyDigest = action({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.digest.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const currentWeek = isoWeekKey(now);

    // Idempotency: if we already generated a digest this ISO week, return it
    if (user.lastDigestAt && user.weeklyDigest) {
      const lastWeek = isoWeekKey(user.lastDigestAt);
      if (lastWeek === currentWeek) {
        return user.weeklyDigest;
      }
    }

    // Gather campus context
    const context = await ctx.runQuery(internal.digest.getDigestContext, {
      userId: user._id,
    });
    if (!context) return null;

    const systemPrompt =
      "You are a campus assistant. Write 3–5 sentences summarising this student's week: what's overdue, " +
      "what's due soon, and any exams. Be warm and encouraging. Do not use markdown — plain sentences only.";

    const userMessage = `Here is the student's campus data for this week:\n\n${context.contextText}`;

    let digest: string | null = null;

    // Try OpenAI first
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.4,
            max_tokens: 200,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        });
        if (response.ok) {
          const json: any = await response.json();
          const content: string | undefined = json?.choices?.[0]?.message?.content;
          if (content) digest = content.trim();
        }
      } catch {
        // Fall through to Anthropic
      }
    }

    // Fall back to Anthropic if OpenAI key is absent or call failed
    if (!digest) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 200,
              temperature: 0.4,
              system: systemPrompt,
              messages: [{ role: "user", content: userMessage }],
            }),
          });
          if (response.ok) {
            const json: any = await response.json();
            const blocks: any[] = json?.content ?? [];
            const textBlock = blocks.find((b) => b?.type === "text");
            if (textBlock?.text) digest = textBlock.text.trim();
          }
        } catch {
          // Both providers failed — fail silently
        }
      }
    }

    if (!digest) return null;

    // Persist to user record
    await ctx.runMutation(internal.digest.saveDigest, {
      userId: user._id,
      digest,
      generatedAt: now,
    });

    // Log to audit log
    try {
      await ctx.runMutation(internal.auditLog.logAction, {
        userId: user._id,
        action: "ai_chat",
        status: "success",
        details: JSON.stringify({
          source: "weekly_digest",
          week: currentWeek,
          overdueCount: context.overdueCount,
          upcomingCount: context.upcomingCount,
          examCount: context.examCount,
        }),
      });
    } catch {
      // Audit log failure must not break digest generation
    }

    return digest;
  },
});
