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
  }).index("by_clerkId", ["clerkId"]),

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
    lastSyncedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_startAt", ["userId", "startAt"])
    .index("by_userId_externalId", ["userId", "externalId"]),

  canvasCredentials: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    canvasBaseUrl: v.string(),
    lastSyncedAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.union(v.literal("success"), v.literal("error"))),
    lastSyncError: v.optional(v.string()),
    coursesSynced: v.optional(v.number()),
    assignmentsSynced: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
});
