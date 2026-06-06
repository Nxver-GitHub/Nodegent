import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

// Allowlist of known browser push-service domains. We check the full hostname
// or a subdomain anchor to prevent substring-match bypasses.
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",         // Chrome / Android
  "push.services.mozilla.com",  // Firefox
  "notify.windows.com",         // Edge
  "push.apple.com",             // Safari
  "updates.push.services.mozilla.com",
];

function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOSTS.some(
    (allowed) => host === allowed || host.endsWith("." + allowed)
  );
}

export const savePushSubscription = mutation({
  args: { subscription: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (args.subscription.length > 4096) {
      throw new Error("Push subscription payload too large");
    }

    // Parse and validate the push endpoint before storing to prevent SSRF.
    let parsed: { endpoint?: unknown };
    try {
      parsed = JSON.parse(args.subscription) as { endpoint?: unknown };
    } catch {
      throw new Error("Invalid subscription payload");
    }
    if (typeof parsed.endpoint !== "string" || !isAllowedPushEndpoint(parsed.endpoint)) {
      throw new Error("Push endpoint not allowed");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { pushSubscription: args.subscription });
  },
});

export const removePushSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { pushSubscription: undefined });
  },
});

export const getSubscriptionForClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    return user?.pushSubscription ?? null;
  },
});

// Returns only users who have a push subscription stored.
// TODO: Add a separate pushSubscribers table to avoid full-scan at scale
// For now: index exists on pushSubscription, but Convex doesn't support !=null index filtering
export const getSubscribedUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(10000);
    return users
      .filter((u) => u.pushSubscription != null)
      .map((u) => ({ _id: u._id, pushSubscription: u.pushSubscription! }));
  },
});

// Assignments due within the next 24 h that the user has not marked done.
// Uses the by_userId_dueAt index to avoid a full table scan per user.
export const getUpcomingAssignmentsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("assignments")
      .withIndex("by_userId_dueAt", (q) =>
        q.eq("userId", args.userId).gte("dueAt", now).lte("dueAt", in24h)
      )
      .filter((q) => q.eq(q.field("isCompleted"), false))
      .collect();
    return rows.map((a) => ({ title: a.title }));
  },
});

// Called by pushSend action to remove a subscription that the push service
// reports as expired or invalid (HTTP 410 / 404).
export const clearStaleSubscription = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { pushSubscription: undefined });
  },
});
