import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const UCSC_BUILTIN_NAME = "UCSC Campus (slug-mcp)";
export const UCSC_BUILTIN_TOOLS = ["search_classes", "get_dining_menu", "search_directory"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];
    return ctx.db
      .query("mcpConnectors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Internal: called from chat action with a resolved userId — no repeated auth overhead
export const listEnabledByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("mcpConnectors")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect();
  },
});

export const ensureUcscBuiltin = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("mcpConnectors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("name"), UCSC_BUILTIN_NAME))
      .unique();
    if (!existing) {
      await ctx.db.insert("mcpConnectors", {
        userId: user._id,
        name: UCSC_BUILTIN_NAME,
        type: "builtin",
        enabled: true,
        tools: UCSC_BUILTIN_TOOLS,
      });
    }
  },
});

export const setEnabled = mutation({
  args: { id: v.id("mcpConnectors"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const connector = await ctx.db.get(args.id);
    if (!connector) throw new Error("Connector not found");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || connector.userId !== user._id) throw new Error("Unauthorized");
    await ctx.db.patch(args.id, { enabled: args.enabled });
  },
});
