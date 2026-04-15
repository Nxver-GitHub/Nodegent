import { mutation, query } from "./_generated/server";

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

    if (existing) {
      // Update profile fields if they changed in Clerk
      const updates: Record<string, string> = {};
      if (identity.name && identity.name !== existing.name) {
        updates.name = identity.name;
      }
      if (identity.email && identity.email !== existing.email) {
        updates.email = identity.email;
      }
      if (identity.pictureUrl && identity.pictureUrl !== existing.imageUrl) {
        updates.imageUrl = identity.pictureUrl;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }

      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? identity.email ?? "Student",
      imageUrl: identity.pictureUrl,
      createdAt: Date.now(),
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
