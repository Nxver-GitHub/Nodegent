import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Canvas API type definitions
// ---------------------------------------------------------------------------

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string | null;
  term?: { name: string };
}

interface CanvasAssignment {
  id: number;
  name: string;
  description?: string | null;
  due_at?: string | null;
  points_possible?: number | null;
  submission_types?: string[];
  html_url?: string | null;
}

// ---------------------------------------------------------------------------
// Pagination helper — follows Canvas Link header rel="next"
// ---------------------------------------------------------------------------

const MAX_PAGES = 20;

async function fetchAllPages<T>(url: string, token: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let pageCount = 0;

  while (nextUrl && pageCount < MAX_PAGES) {
    const response: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Invalid Canvas access token");
      if (response.status === 403) throw new Error("Canvas access forbidden — check token permissions");
      throw new Error(`Canvas API error: ${response.status}`);
    }

    const page: T[] = await response.json();
    results.push(...page);
    pageCount++;

    const linkHeader: string = response.headers.get("Link") ?? "";
    const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Internal helpers — server-side only, never callable from the browser
// ---------------------------------------------------------------------------

export const getCredentialsForAction = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("canvasCredentials")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const updateSyncStatus = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("success"), v.literal("error")),
    coursesSynced: v.optional(v.number()),
    assignmentsSynced: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const creds = await ctx.db
      .query("canvasCredentials")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!creds) return;
    await ctx.db.patch(creds._id, {
      lastSyncedAt: Date.now(),
      lastSyncStatus: args.status,
      lastSyncError: args.error,
      ...(args.coursesSynced !== undefined ? { coursesSynced: args.coursesSynced } : {}),
      ...(args.assignmentsSynced !== undefined ? { assignmentsSynced: args.assignmentsSynced } : {}),
    });
  },
});

// ---------------------------------------------------------------------------
// Public query — returns sync status only, never the access token
// ---------------------------------------------------------------------------

export const getCanvasStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const creds = await ctx.db
      .query("canvasCredentials")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!creds) return null;

    // Return status fields ONLY — never return accessToken
    return {
      canvasBaseUrl: creds.canvasBaseUrl,
      lastSyncedAt: creds.lastSyncedAt,
      lastSyncStatus: creds.lastSyncStatus,
      lastSyncError: creds.lastSyncError,
      coursesSynced: creds.coursesSynced,
      assignmentsSynced: creds.assignmentsSynced,
    };
  },
});

// ---------------------------------------------------------------------------
// saveCanvasToken — store the user's Canvas access token server-side
// ---------------------------------------------------------------------------

export const saveCanvasToken = mutation({
  args: {
    accessToken: v.string(),
    canvasBaseUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    if (!args.accessToken.trim()) throw new Error("Access token is required");
    const url = args.canvasBaseUrl.trim().replace(/\/$/, "");
    if (!url.startsWith("https://")) throw new Error("Canvas URL must use HTTPS");

    const existing = await ctx.db
      .query("canvasCredentials")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken.trim(),
        canvasBaseUrl: url,
        lastSyncStatus: undefined,
        lastSyncError: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("canvasCredentials", {
      userId: user._id,
      accessToken: args.accessToken.trim(),
      canvasBaseUrl: url,
    });
  },
});

// ---------------------------------------------------------------------------
// removeCanvasToken — delete the user's stored credentials
// ---------------------------------------------------------------------------

export const removeCanvasToken = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const creds = await ctx.db
      .query("canvasCredentials")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (creds) {
      await ctx.db.delete(creds._id);
    }
  },
});

// ---------------------------------------------------------------------------
// syncCanvas action — calls Canvas API server-side, upserts into Convex
// ---------------------------------------------------------------------------

export const syncCanvas = action({
  args: {},
  handler: async (ctx): Promise<{ coursesSynced: number; assignmentsSynced: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) throw new Error("User not found");

    const creds = await ctx.runQuery(internal.canvas.getCredentialsForAction, {
      userId: user._id,
    });
    if (!creds) throw new Error("Canvas not connected");

    const { accessToken, canvasBaseUrl } = creds;

    try {
      const courses = await fetchAllPages<CanvasCourse>(
        `${canvasBaseUrl}/api/v1/courses?enrollment_state=active&include[]=term&per_page=50`,
        accessToken
      );

      let coursesSynced = 0;
      let assignmentsSynced = 0;

      for (const course of courses) {
        const courseId: Id<"courses"> = await ctx.runMutation(api.courses.upsertCourse, {
          canvasId: String(course.id),
          name: course.name,
          courseCode: course.course_code ?? course.name,
          term: course.term?.name ?? "Unknown Term",
        });
        coursesSynced++;

        const assignments = await fetchAllPages<CanvasAssignment>(
          `${canvasBaseUrl}/api/v1/courses/${course.id}/assignments?order_by=due_at&bucket=future&per_page=50`,
          accessToken
        );

        for (const assignment of assignments) {
          await ctx.runMutation(api.assignments.upsertAssignment, {
            courseId,
            canvasId: String(assignment.id),
            title: assignment.name,
            description: assignment.description ?? undefined,
            dueAt: assignment.due_at ? new Date(assignment.due_at).getTime() : undefined,
            pointsPossible: assignment.points_possible ?? undefined,
            submissionType: assignment.submission_types?.join(",") ?? undefined,
            htmlUrl: assignment.html_url ?? undefined,
          });
          assignmentsSynced++;
        }
      }

      await ctx.runMutation(internal.canvas.updateSyncStatus, {
        userId: user._id,
        status: "success",
        coursesSynced,
        assignmentsSynced,
      });

      return { coursesSynced, assignmentsSynced };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown sync error";
      await ctx.runMutation(internal.canvas.updateSyncStatus, {
        userId: user._id,
        status: "error",
        error: message,
      });
      throw err;
    }
  },
});
