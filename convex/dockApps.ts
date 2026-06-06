import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_CUSTOM_APPS = 8;

export const getDockApps = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("dockApps")
      .withIndex("by_userId_order", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const addDockApp = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    icon: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    if (args.url) {
      if (!/^https?:\/\//i.test(args.url)) throw new Error("URL must use http or https");
      if (args.url.length > 2048) throw new Error("URL too long");
    }

    const existing = await ctx.db
      .query("dockApps")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    if (existing.length >= MAX_CUSTOM_APPS) {
      throw new Error(`Maximum ${MAX_CUSTOM_APPS} custom apps allowed`);
    }

    const maxOrder = existing.reduce((max, app) => Math.max(max, app.order), -1);

    await ctx.db.insert("dockApps", {
      userId: user._id,
      name: args.name.slice(0, 20),
      url: args.url,
      icon: args.icon,
      color: args.color,
      order: maxOrder + 1,
    });
  },
});

export const deleteDockApp = mutation({
  args: { id: v.id("dockApps") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const app = await ctx.db.get(args.id);
    if (!app || app.userId !== user._id) throw new Error("App not found");

    await ctx.db.delete(args.id);
  },
});

export const reorderDockApps = mutation({
  args: { ids: v.array(v.id("dockApps")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    await Promise.all(
      args.ids.map(async (id, index) => {
        const app = await ctx.db.get(id);
        if (!app || app.userId !== user._id) throw new Error("Unauthorized");
        await ctx.db.patch(id, { order: index });
      })
    );
  },
});

export const toggleHideDefaultApp = mutation({
  args: { appId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const hidden = user.hiddenDefaultApps ?? [];
    const isHidden = hidden.includes(args.appId);
    const updated = isHidden
      ? hidden.filter((id) => id !== args.appId)
      : [...hidden, args.appId];

    await ctx.db.patch(user._id, { hiddenDefaultApps: updated });
  },
});

export const toggleAiQueryable = mutation({
  args: { id: v.id("dockApps"), aiQueryable: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    const app = await ctx.db.get(args.id);
    if (!app || app.userId !== user._id) throw new Error("App not found");
    await ctx.db.patch(args.id, { aiQueryable: args.aiQueryable });
  },
});
