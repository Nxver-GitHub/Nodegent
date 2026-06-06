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
  args: {
    userId: v.id("users"),
    hiddenCourseIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const now = Date.now();
    const weekEnd = now + 7 * 24 * 60 * 60 * 1000;

    const hiddenSet = new Set<string>(args.hiddenCourseIds ?? []);

    const allCourses = await ctx.db
      .query("courses")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(50);

    const courses = allCourses.filter((c) => !hiddenSet.has(c._id));

    const courseById = new Map<string, string>();
    for (const c of courses) {
      courseById.set(c._id, c.courseCode);
    }

    const recentWindow = now - 7 * 24 * 60 * 60 * 1000;

    // Upcoming: not completed, due within next 7 days — visible courses only
    const upcomingAssignments = (
      await ctx.db
        .query("assignments")
        .withIndex("by_userId_dueAt", (q) =>
          q.eq("userId", args.userId).gte("dueAt", now).lte("dueAt", weekEnd)
        )
        .order("asc")
        .take(50)
    ).filter((a) => courseById.has(a.courseId) && !a.isCompleted).slice(0, 15);

    // Recently added to Canvas (isNew flag set by sync) — visible, not completed
    const recentlyAdded = (
      await ctx.db
        .query("assignments")
        .withIndex("by_userId_isNew", (q) =>
          q.eq("userId", args.userId).eq("isNew", true)
        )
        .take(50)
    ).filter((a) => courseById.has(a.courseId) && !a.isCompleted).slice(0, 8);

    // Recently graded (has a score, due in last 14 days) — visible courses only
    const recentlyGraded = (
      await ctx.db
        .query("assignments")
        .withIndex("by_userId_dueAt", (q) =>
          q.eq("userId", args.userId)
            .gte("dueAt", now - 14 * 24 * 60 * 60 * 1000)
            .lte("dueAt", now)
        )
        .order("desc")
        .take(50)
    ).filter((a) => courseById.has(a.courseId) && a.score !== undefined).slice(0, 5);

    // Upcoming exams in next 7 days
    const upcomingExams = await ctx.db
      .query("events")
      .withIndex("by_userId_startAt", (q) =>
        q.eq("userId", args.userId).gte("startAt", now).lte("startAt", weekEnd)
      )
      .filter((q) => q.eq(q.field("eventType"), "exam"))
      .order("asc")
      .take(5);

    const fmt = (ts: number) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(ts));

    const courseNames = courses.map((c) => `${c.courseCode}: ${c.name}`);

    const upcomingLines = upcomingAssignments.map((a) => {
      const code = courseById.get(a.courseId) ?? "Unknown";
      return `  - [${code}] ${a.title} — due ${a.dueAt ? fmt(a.dueAt) : "no date"}`;
    });

    const recentlyAddedLines = recentlyAdded.map((a) => {
      const code = courseById.get(a.courseId) ?? "Unknown";
      return `  - [${code}] ${a.title}${a.dueAt ? ` — due ${fmt(a.dueAt)}` : ""}`;
    });

    const recentlyGradedLines = recentlyGraded.map((a) => {
      const code = courseById.get(a.courseId) ?? "Unknown";
      return `  - [${code}] ${a.title} — scored ${a.score}`;
    });

    const examLines = upcomingExams.map((e) => `  - ${e.title} — ${fmt(e.startAt)}`);

    const contextText = [
      `Courses: ${courseNames.join(", ") || "none"}`,
      upcomingLines.length > 0
        ? `Upcoming this week (${upcomingLines.length}):\n${upcomingLines.join("\n")}`
        : "Nothing pending this week.",
      recentlyAddedLines.length > 0
        ? `Recently added to Canvas (${recentlyAddedLines.length}):\n${recentlyAddedLines.join("\n")}`
        : "",
      recentlyGradedLines.length > 0
        ? `Recently graded (${recentlyGradedLines.length}):\n${recentlyGradedLines.join("\n")}`
        : "",
      examLines.length > 0
        ? `Upcoming exams:\n${examLines.join("\n")}`
        : "No upcoming exams.",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Collect all assignment links for the banner
    const linkSet = new Map<string, { title: string; course: string; url: string }>();
    for (const a of [...upcomingAssignments, ...recentlyAdded, ...recentlyGraded]) {
      if (a.htmlUrl && !linkSet.has(a._id)) {
        linkSet.set(a._id, {
          title: a.title,
          course: courseById.get(a.courseId) ?? "",
          url: a.htmlUrl,
        });
      }
    }

    return {
      contextText,
      upcomingCount: upcomingAssignments.length,
      recentCount: recentlyAdded.length,
      examCount: upcomingExams.length,
      links: [...linkSet.values()],
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
  args: {
    hiddenCourseIds: v.optional(v.array(v.string())),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.digest.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const currentWeek = isoWeekKey(now);

    // Idempotency: if we already generated a digest this ISO week, return it
    // Skip if force=true (e.g. visible course set changed)
    if (!args.force && user.lastDigestAt && user.weeklyDigest) {
      const lastWeek = isoWeekKey(user.lastDigestAt);
      if (lastWeek === currentWeek) {
        return user.weeklyDigest;
      }
    }

    // Gather campus context, filtering to visible courses only
    const context = await ctx.runQuery(internal.digest.getDigestContext, {
      userId: user._id,
      hiddenCourseIds: args.hiddenCourseIds,
    });
    if (!context) return null;

    const systemPrompt =
      "You are a campus assistant. Write 3–5 sentences summarising the student's upcoming week: " +
      "what assignments are coming up, any recently added work, and recent grades they should know about. " +
      "Do NOT mention overdue assignments — focus only on what's ahead. Be warm and encouraging. " +
      "Do not use markdown — plain sentences only.";

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
          // Fall through to Groq
        }
      }
    }

    // Fall back to Groq (OpenAI-compatible) if prior providers unavailable
    if (!digest) {
      const groqKey = process.env.GROQ_API_KEY;
      const groqModel = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
      if (groqKey) {
        try {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: groqModel,
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
          // All providers failed — fail silently
        }
      }
    }

    if (!digest) return null;

    // Encode AI text + links as a single JSON string for storage and display
    const payload = JSON.stringify({ text: digest, links: context.links ?? [] });

    // Persist to user record
    await ctx.runMutation(internal.digest.saveDigest, {
      userId: user._id,
      digest: payload,
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
          upcomingCount: context.upcomingCount,
          recentCount: context.recentCount,
          examCount: context.examCount,
        }),
      });
    } catch {
      // Audit log failure must not break digest generation
    }

    return payload;
  },
});
