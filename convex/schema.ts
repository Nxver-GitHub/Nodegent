import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastSyncedAt: v.optional(v.number()),
    lastCalendarSyncAt: v.optional(v.number()),
    lastCalendarSyncStatus: v.optional(v.union(v.literal("success"), v.literal("error"))),
    lastCalendarSyncError: v.optional(v.string()),
  }).index("by_clerkId", ["clerkId"]),

  chatThreads: defineTable({
    userId: v.id("users"),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
    contextRefs: v.optional(
      v.array(
        v.object({
          type: v.union(
            v.literal("course"),
            v.literal("assignment"),
            v.literal("event")
          ),
          id: v.string(),
          label: v.string(),
        })
      )
    ),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
  })
    .index("by_threadId", ["threadId"])
    .index("by_threadId_createdAt", ["threadId", "createdAt"])
    .index("by_userId", ["userId"]),

  chatRateLimits: defineTable({
    userId: v.id("users"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_userId", ["userId"]),

  courses: defineTable({
    userId: v.id("users"),
    canvasId: v.string(),
    name: v.string(),
    courseCode: v.string(),
    term: v.string(),
    instructorName: v.optional(v.string()),
    syllabusUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_canvasId", ["userId", "canvasId"]),

  assignments: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    canvasId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    pointsPossible: v.optional(v.number()),
    submissionType: v.optional(v.string()),
    isCompleted: v.boolean(),
    htmlUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
    googleCalendarEventId: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_courseId", ["courseId"])
    .index("by_userId_dueAt", ["userId", "dueAt"])
    .index("by_userId_canvasId", ["userId", "canvasId"])
    .index("by_userId_courseId", ["userId", "courseId"]),

  events: defineTable({
    userId: v.id("users"),
    courseId: v.optional(v.id("courses")),
    title: v.string(),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    location: v.optional(v.string()),
    eventType: v.union(v.literal("class"), v.literal("exam"), v.literal("other")),
    externalId: v.optional(v.string()),
    source: v.optional(v.union(v.literal("canvas"), v.literal("google_calendar"), v.literal("manual"))),
    lastSyncedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_startAt", ["userId", "startAt"])
    .index("by_userId_externalId", ["userId", "externalId"])
    .index("by_userId_source", ["userId", "source"]),

  canvasCredentials: defineTable({
    userId: v.id("users"),
    // Legacy PAT field — kept optional so existing rows remain valid during migration
    accessToken: v.optional(v.string()),
    // JSON-serialized array of Playwright session cookies
    canvasCookies: v.optional(v.string()),
    // Kept optional; hardcoded to canvas.ucsc.edu in application logic
    canvasBaseUrl: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.union(v.literal("success"), v.literal("error"))),
    lastSyncError: v.optional(v.string()),
    coursesSynced: v.optional(v.number()),
    assignmentsSynced: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
});
