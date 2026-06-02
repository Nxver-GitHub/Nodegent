import { mutation } from "./_generated/server";
import { v } from "convex/values";

const listingShape = {
  courseCode: v.string(),
  sectionNumber: v.string(),
  title: v.string(),
  instructor: v.optional(v.string()),
  enrolled: v.optional(v.number()),
  capacity: v.optional(v.number()),
  status: v.optional(v.string()),
  meetingDays: v.optional(v.string()),
  meetingTimes: v.optional(v.string()),
  location: v.optional(v.string()),
  instructionMode: v.optional(v.string()),
  geRequirements: v.optional(v.string()),
};

export const upsertListings = mutation({
  args: {
    term: v.string(),
    listings: v.array(v.object(listingShape)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const now = Date.now();
    let synced = 0;
    for (const listing of args.listings) {
      const existing = await ctx.db
        .query("courseListings")
        .withIndex("by_userId_courseCode", (q) =>
          q.eq("userId", user._id).eq("courseCode", listing.courseCode)
        )
        .filter((q) => q.eq(q.field("sectionNumber"), listing.sectionNumber))
        .filter((q) => q.eq(q.field("term"), args.term))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { ...listing, term: args.term, lastSyncedAt: now });
      } else {
        await ctx.db.insert("courseListings", {
          userId: user._id,
          term: args.term,
          ...listing,
          lastSyncedAt: now,
        });
      }
      synced++;
    }
    return { synced };
  },
});
