"use node";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush from "web-push";

export const sendDailyNotifications = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidContact =
      process.env.VAPID_CONTACT ?? "mailto:suryapugaz1629@gmail.com";

    if (!vapidPublicKey || !vapidPrivateKey) return;

    webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);

    const users = await ctx.runQuery(internal.push.getSubscribedUsers, {});

    for (const user of users) {
      try {
        const assignments = await ctx.runQuery(
          internal.push.getUpcomingAssignmentsForUser,
          { userId: user._id }
        );

        if (assignments.length === 0) continue;

        const count = assignments.length;
        const body =
          count === 1
            ? `"${assignments[0].title}" is due in the next 24 hours.`
            : `${count} assignments are due in the next 24 hours.`;

        const subscription = JSON.parse(user.pushSubscription) as Parameters<
          typeof webpush.sendNotification
        >[0];

        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: "Upcoming deadlines", body, url: "/dashboard" })
        );
      } catch (err: unknown) {
        // 410 Gone / 404 Not Found — subscription has been invalidated by the
        // browser push service. Remove it so we don't waste bandwidth again.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await ctx.runMutation(internal.push.clearStaleSubscription, {
            userId: user._id,
          });
        }
        // Any other error: skip silently, try again next day
      }
    }
  },
});

// Dev/test helper: sends a test notification to the caller's stored push
// subscription, regardless of upcoming assignments.
export const sendTestPushToSelf = action({
  args: {},
  handler: async (ctx): Promise<{ sent: boolean; reason?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidContact =
      process.env.VAPID_CONTACT ?? "mailto:suryapugaz1629@gmail.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return { sent: false, reason: "VAPID keys not configured in Convex env" };
    }

    const sub = await ctx.runQuery(internal.push.getSubscriptionForClerkId, {
      clerkId: identity.subject,
    });
    if (!sub) {
      return {
        sent: false,
        reason: "No push subscription stored. Enable notifications in Settings first.",
      };
    }

    webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);

    try {
      const subscription = JSON.parse(sub) as Parameters<
        typeof webpush.sendNotification
      >[0];
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: "Test notification",
          body: "Push notifications are working! You will be notified about upcoming deadlines.",
          url: "/dashboard",
        })
      );
      return { sent: true };
    } catch {
      return { sent: false, reason: "Push delivery failed — subscription may be stale" };
    }
  },
});
