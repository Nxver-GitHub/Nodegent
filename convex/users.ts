import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  DEFAULT_TIMEZONE,
  dayKey,
  displayedStreak,
  safeTimezone,
} from "./streak.helpers";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export const ensureUser = mutation({
  args: {
    // US-8.3: browser-detected IANA timezone, validated server-side.
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const now = Date.now();
    const validatedTz = safeTimezone(args.timezone);

    if (existing) {
      // Server-side rate guard: skip writes if synced recently — but the
      // timezone change is rare and worth persisting outside the cooldown.
      const tzChanged =
        validatedTz !== undefined && existing.timezone !== validatedTz;
      if (
        existing.lastSyncedAt &&
        now - existing.lastSyncedAt < SYNC_COOLDOWN_MS &&
        !tzChanged
      ) {
        return existing._id;
      }

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
      if (tzChanged && validatedTz !== undefined) {
        updates.timezone = validatedTz;
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
      ...(validatedTz !== undefined ? { timezone: validatedTz } : {}),
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return null;

    // US-8.3: apply read-side gap reset to currentStreak so stale streaks
    // expire without an extra write. lastCompletionDate stays raw so callers
    // can render a tooltip showing the last day completed.
    const tz = user.timezone ?? DEFAULT_TIMEZONE;
    const todayKey = dayKey(Date.now(), tz);
    const resolvedStreak = displayedStreak(
      {
        currentStreak: user.currentStreak,
        lastCompletionDate: user.lastCompletionDate,
      },
      todayKey,
      tz,
    );

    return {
      ...user,
      currentStreak: resolvedStreak,
    };
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
      await ctx.db.insert("auditLog", {
        userId: user._id,
        action: "access_toggle",
        status: "success",
        details: JSON.stringify(patch),
        timestamp: Date.now(),
      });
    }
  },
});

export const updateUniversity = mutation({
  args: { university: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { university: args.university });
  },
});

export const markOnboardingComplete = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { onboardingCompleted: true });
  },
});

export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return null;

    return {
      canvasEnabled: user.canvasEnabled,
      calendarEnabled: user.calendarEnabled,
    };
  },
});
