import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Fire at 16:00 UTC = 8:00 AM PST / 9:00 AM PDT — covers PST and PDT safely.
crons.daily(
  "send-push-notifications",
  { hourUTC: 16, minuteUTC: 0 },
  internal.pushSend.sendDailyNotifications
);

// Prune audit-log rows past the retention window so the table doesn't grow
// unbounded. Runs off-peak (09:00 UTC ≈ 1-2 AM Pacific).
crons.daily(
  "prune-audit-log",
  { hourUTC: 9, minuteUTC: 0 },
  internal.auditLog.pruneOldEntries
);

export default crons;
