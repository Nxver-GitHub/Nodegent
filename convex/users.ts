import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const now = Date.now();

    if (existing) {
      // Server-side rate guard: skip writes if synced recently
      if (existing.lastSyncedAt && now - existing.lastSyncedAt < SYNC_COOLDOWN_MS) {
        return existing._id;
      }

      // Update profile fields if they changed in Clerk
      const updates: Record<string, string | number> = { lastSyncedAt: now };
      if (identity.name && identity.name !== existing.name) {
        updates.name = identity.name;
      }
      if (identity.email && identity.email !== existing.email) {
        updates.email = identity.email;
      }
      if (identity.pictureUrl && identity.pictureUrl !== existing.imageUrl) {
        updates.imageUrl = identity.pictureUrl;
      }

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? identity.email ?? "Student",
      imageUrl: identity.pictureUrl,
      createdAt: now,
      lastSyncedAt: now,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});

export const updateAccessToggles = mutation({
  args: {
    canvasEnabled: v.optional(v.boolean()),
    calendarEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const patch: Partial<{ canvasEnabled: boolean; calendarEnabled: boolean }> = {};
    if (args.canvasEnabled !== undefined) patch.canvasEnabled = args.canvasEnabled;
    if (args.calendarEnabled !== undefined) patch.calendarEnabled = args.calendarEnabled;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
  },
});

export const getUserSettingsInternal = query({
  args: {
    clerkUserId: v.string(),
    internalSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !process.env.CONVEX_INTERNAL_SECRET ||
      args.internalSecret !== process.env.CONVEX_INTERNAL_SECRET
    ) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
      .unique();

    if (!user) return null;

    return {
      canvasEnabled: user.canvasEnabled,
      calendarEnabled: user.calendarEnabled,
    };
  },
});
