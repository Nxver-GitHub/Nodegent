import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { MAX_NOTE_CONTENT_CHARS } from "./courseNotes.shared";

export { MAX_NOTE_CONTENT_CHARS };

// List all notes for one course, newest first. Uses Convex's auto
// `_creationTime` so the schema stays minimal. Returns [] for unauth
// or non-owner — queries degrade gracefully so reactive subscribers
// don't crash on transient state.
export const listCourseNotes = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) return [];

    const notes = await ctx.db
      .query("courseNotes")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId)
      )
      .collect();

    return notes
      .map((n) => ({
        _id: n._id,
        content: n.content,
        createdAt: n._creationTime,
        updatedAt: n.updatedAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const addCourseNote = mutation({
  args: {
    courseId: v.id("courses"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== user._id) throw new Error("Unauthorized");

    const trimmed = args.content.trim();
    if (trimmed.length === 0) throw new Error("Note is empty");
    if (trimmed.length > MAX_NOTE_CONTENT_CHARS) {
      throw new Error("Note exceeds maximum length");
    }

    return await ctx.db.insert("courseNotes", {
      userId: user._id,
      courseId: args.courseId,
      content: trimmed,
      updatedAt: Date.now(),
    });
  },
});

export const updateCourseNote = mutation({
  args: {
    noteId: v.id("courseNotes"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db.get(args.noteId);
    if (!existing || existing.userId !== user._id) throw new Error("Unauthorized");

    const trimmed = args.content.trim();
    if (trimmed.length === 0) throw new Error("Note is empty");
    if (trimmed.length > MAX_NOTE_CONTENT_CHARS) {
      throw new Error("Note exceeds maximum length");
    }

    // Skip no-op writes — bandwidth reduction (see f63a382).
    if (existing.content === trimmed) return existing._id;

    await ctx.db.patch(existing._id, {
      content: trimmed,
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

export const deleteCourseNote = mutation({
  args: { noteId: v.id("courseNotes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db.get(args.noteId);
    if (!existing || existing.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.delete(args.noteId);
  },
});
