"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";

type ChipStatus = "synced" | "error" | "auth-error" | "never";

function StatusChip({ status, label }: { status: ChipStatus; label: string }) {
  const styles: Record<ChipStatus, string> = {
    synced: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
    "auth-error": "bg-amber-50 border-amber-200 text-amber-700",
    never: "bg-gray-100 border-gray-200 text-gray-600",
  };
  const dots: Record<ChipStatus, string> = {
    synced: "bg-green-400",
    error: "bg-red-400",
    "auth-error": "bg-amber-400",
    never: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dots[status]}`} />
      {label}
    </span>
  );
}

interface SyncResult {
  eventsPushed?: number;
  eventsPulled?: number;
  pushErrors?: string[];
  error?: string;
  code?: string;
}

/** Exported for US-5.5 auto-sync: always eligible (server-side validates token). */
export function useCalendarSyncEligibility() {
  return { shouldSync: true };
}

export function CompactCalendarSync() {
  const status = useQuery(api.googleCalendar.getCalendarSyncStatus);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" });
      const data = (await res.json()) as SyncResult;
      setLastResult(data);
    } catch {
      setLastResult({ error: "Network error — please try again." });
    } finally {
      setIsSyncing(false);
    }
  }

  // Loading skeleton
  if (status === undefined) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
      </div>
    );
  }

  const isAuthError =
    lastResult?.code === "NO_GOOGLE_TOKEN" || lastResult?.code === "GOOGLE_AUTH_ERROR";

  let chipStatus: ChipStatus = "never";
  let chipLabel = "Never synced";
  if (lastResult?.error && isAuthError) {
    chipStatus = "auth-error";
    chipLabel = "Auth required";
  } else if (lastResult?.error) {
    chipStatus = "error";
    chipLabel = "Sync error";
  } else if (status?.lastCalendarSyncStatus === "error" && !lastResult) {
    chipStatus = "error";
    chipLabel = "Sync error";
  } else if (status?.lastCalendarSyncAt) {
    chipStatus = "synced";
    chipLabel = "Synced";
  }

  const lastSync = status?.lastCalendarSyncAt
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.round((Date.now() - status.lastCalendarSyncAt) / 60000),
        "minute"
      )
    : null;

  return (
    <div>
      <div className="flex items-center justify-between py-3">
        <div className="min-w-0 mr-3">
          <span className="text-sm font-semibold text-gray-800">Google Calendar</span>
          {lastSync && (
            <p className="text-xs text-gray-500 mt-0.5">Last sync {lastSync}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusChip status={chipStatus} label={chipLabel} />
          <button
            onClick={handleSync}
            disabled={isSyncing}
            aria-label={isSyncing ? "Syncing calendar…" : "Sync Google Calendar"}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40 transition-colors"
          >
            <ArrowsClockwise
              size={15}
              weight="bold"
              className={isSyncing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* Inline error messages */}
      {isAuthError && (
        <p className="text-xs text-amber-700 pb-2">
          Calendar access not granted — sign out and sign back in with Google to enable sync.
        </p>
      )}
      {lastResult?.error && !isAuthError && (
        <p className="text-xs text-red-600 pb-2">{lastResult.error}</p>
      )}
      {status?.lastCalendarSyncStatus === "error" && status.lastCalendarSyncError && !lastResult && (
        <p className="text-xs text-red-600 pb-2">{status.lastCalendarSyncError}</p>
      )}
      {lastResult && !lastResult.error && (
        <p className="text-xs text-green-700 pb-2">
          {lastResult.eventsPushed ?? 0} assignment{lastResult.eventsPushed !== 1 ? "s" : ""} pushed
          {" · "}
          {lastResult.eventsPulled ?? 0} event{lastResult.eventsPulled !== 1 ? "s" : ""} pulled
        </p>
      )}
    </div>
  );
}
