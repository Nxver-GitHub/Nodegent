import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_BASE_URL = "https://canvas.ucsc.edu";
const MAX_PAGES = 20;

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

interface PlaywrightCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function cookiesToHeader(cookies: PlaywrightCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

// ---------------------------------------------------------------------------
// Pagination helper — follows Canvas Link header rel="next" using Cookie auth
// ---------------------------------------------------------------------------

async function fetchAllPagesWithCookies<T>(
  url: string,
  cookieHeader: string
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let pageCount = 0;

  while (nextUrl && pageCount < MAX_PAGES) {
    const response: Response = await fetch(nextUrl, {
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 302) {
        throw new Error(
          "Canvas session expired. Please reconnect Canvas in the dashboard."
        );
      }
      if (response.status === 403) {
        throw new Error("Canvas access forbidden — session may have expired");
      }
      throw new Error(`Canvas API error: ${response.status}`);
    }

    const page: T[] = await response.json();
    results.push(...page);
    pageCount++;

    const linkHeader: string = response.headers.get("Link") ?? "";
    const nextMatch: RegExpMatchArray | null = linkHeader.match(
      /<([^>]+)>;\s*rel="next"/
    );
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

export const upsertCanvasCookies = internalMutation({
  args: {
    userId: v.id("users"),
    canvasCookies: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("canvasCredentials")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        canvasCookies: args.canvasCookies,
        // Clear legacy PAT and stale sync state on reconnect
        accessToken: undefined,
        lastSyncStatus: undefined,
        lastSyncError: undefined,
      });
    } else {
      await ctx.db.insert("canvasCredentials", {
        userId: args.userId,
        canvasCookies: args.canvasCookies,
        canvasBaseUrl: CANVAS_BASE_URL,
      });
    }
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
      ...(args.assignmentsSynced !== undefined
        ? { assignmentsSynced: args.assignmentsSynced }
        : {}),
    });
  },
});

// ---------------------------------------------------------------------------
// Public query — returns sync status only, never credentials
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

    // Only return status fields — NEVER return canvasCookies or accessToken
    return {
      isConnected: !!creds.canvasCookies,
      canvasBaseUrl: CANVAS_BASE_URL,
      lastSyncedAt: creds.lastSyncedAt,
      lastSyncStatus: creds.lastSyncStatus,
      lastSyncError: creds.lastSyncError,
      coursesSynced: creds.coursesSynced,
      assignmentsSynced: creds.assignmentsSynced,
    };
  },
});

// ---------------------------------------------------------------------------
// saveCanvasCookies action — stores cookie array server-side
// Called from /api/canvas-auth/save after Playwright SSO completes
// ---------------------------------------------------------------------------

export const saveCanvasCookies = action({
  args: {
    // JSON-serialized array of Playwright cookie objects
    cookiesJson: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // ensureUser creates the row if it doesn't exist yet (handles the race
    // where Canvas auth completes before the dashboard useEffect fires).
    const userId = await ctx.runMutation(api.users.ensureUser, {});

    let cookies: PlaywrightCookie[];
    try {
      const parsed: unknown = JSON.parse(args.cookiesJson);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      cookies = parsed as PlaywrightCookie[];
    } catch {
      throw new Error("cookiesJson must be a valid JSON array");
    }

    if (cookies.length === 0) {
      throw new Error("No Canvas session cookies were provided");
    }

    await ctx.runMutation(internal.canvas.upsertCanvasCookies, {
      userId,
      canvasCookies: JSON.stringify(cookies),
    });
  },
});

// ---------------------------------------------------------------------------
// saveCanvasCookiesInternal — server-to-server mutation, no Clerk JWT needed
// Called from /api/canvas-auth/save using a shared CONVEX_INTERNAL_SECRET.
// This avoids the Clerk "convex" JWT template requirement for server-side calls.
// ---------------------------------------------------------------------------

export const saveCanvasCookiesInternal = mutation({
  args: {
    clerkUserId: v.string(),
    cookiesJson: v.string(),
    internalSecret: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!process.env.CONVEX_INTERNAL_SECRET || args.internalSecret !== process.env.CONVEX_INTERNAL_SECRET) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
      .unique();
    if (!user) throw new Error("User not found — visit the dashboard before connecting Canvas");

    let cookies: PlaywrightCookie[];
    try {
      const parsed: unknown = JSON.parse(args.cookiesJson);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      cookies = parsed as PlaywrightCookie[];
    } catch {
      throw new Error("cookiesJson must be a valid JSON array");
    }
    if (cookies.length === 0) throw new Error("No Canvas session cookies were provided");

    const existing = await ctx.db
      .query("canvasCredentials")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        canvasCookies: JSON.stringify(cookies),
        accessToken: undefined,
        lastSyncStatus: undefined,
        lastSyncError: undefined,
      });
    } else {
      await ctx.db.insert("canvasCredentials", {
        userId: user._id,
        canvasCookies: JSON.stringify(cookies),
        canvasBaseUrl: CANVAS_BASE_URL,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// removeCanvasCredentials — delete the user's stored credentials
// ---------------------------------------------------------------------------

export const removeCanvasCredentials = mutation({
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
// syncCanvas action — reads cookies, calls Canvas API, upserts into Convex
// ---------------------------------------------------------------------------

export const syncCanvas = action({
  args: {},
  handler: async (ctx): Promise<{ coursesSynced: number; assignmentsSynced: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) throw new Error("User not found");

    if (user.canvasEnabled === false) {
      throw new Error("Canvas sync is disabled. Enable it in your access settings.");
    }

    const creds = await ctx.runQuery(internal.canvas.getCredentialsForAction, {
      userId: user._id,
    });
    if (!creds) throw new Error("Canvas not connected");
    if (!creds.canvasCookies) {
      throw new Error(
        "Canvas credentials not found. Please disconnect and reconnect Canvas."
      );
    }

    let cookies: PlaywrightCookie[];
    try {
      cookies = JSON.parse(creds.canvasCookies) as PlaywrightCookie[];
    } catch {
      throw new Error("Failed to read Canvas credentials. Please reconnect Canvas.");
    }

    const cookieHeader = cookiesToHeader(cookies);

    try {
      const courses = await fetchAllPagesWithCookies<CanvasCourse>(
        `${CANVAS_BASE_URL}/api/v1/courses?enrollment_state=active&include[]=term&per_page=50`,
        cookieHeader
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

        const assignments = await fetchAllPagesWithCookies<CanvasAssignment>(
          `${CANVAS_BASE_URL}/api/v1/courses/${course.id}/assignments?order_by=due_at&bucket=future&per_page=50`,
          cookieHeader
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
