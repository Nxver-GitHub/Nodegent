"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface SyncResult {
  eventsPushed?: number;
  eventsPulled?: number;
  pushErrors?: string[];
  error?: string;
  code?: string;
}

export function GoogleCalendarCard() {
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

  if (status === undefined) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-gray-500">Loading Calendar status...</p>
      </div>
    );
  }

  const lastSync = status?.lastCalendarSyncAt
    ? new Date(status.lastCalendarSyncAt).toLocaleString()
    : null;

  const isAuthError =
    lastResult?.code === "NO_GOOGLE_TOKEN" ||
    lastResult?.code === "GOOGLE_AUTH_ERROR";

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Google Calendar</h3>
        {lastSync && status?.lastCalendarSyncStatus === "success" && (
          <span className="text-sm font-medium text-green-600">Synced</span>
        )}
        {status?.lastCalendarSyncStatus === "error" && !lastResult && (
          <span className="text-sm font-medium text-red-500">Sync error</span>
        )}
      </div>

      {lastSync && (
        <p className="mt-1 text-sm text-gray-500">Last synced: {lastSync}</p>
      )}

      {/* Persistent error from Convex (previous session) */}
      {status?.lastCalendarSyncStatus === "error" &&
        status.lastCalendarSyncError &&
        !lastResult && (
          <p className="mt-2 text-sm text-red-600">
            {status.lastCalendarSyncError}
          </p>
        )}

      {/* Result from the current sync attempt */}
      {lastResult && !lastResult.error && (
        <p className="mt-2 text-sm text-green-700">
          Synced: {lastResult.eventsPushed ?? 0} assignment
          {lastResult.eventsPushed !== 1 ? "s" : ""} pushed ·{" "}
          {lastResult.eventsPulled ?? 0} event
          {lastResult.eventsPulled !== 1 ? "s" : ""} pulled
        </p>
      )}

      {lastResult?.pushErrors && lastResult.pushErrors.length > 0 && (
        <p className="mt-1 text-xs text-amber-600">
          {lastResult.pushErrors.length} assignment
          {lastResult.pushErrors.length !== 1 ? "s" : ""} could not be pushed
        </p>
      )}

      {lastResult?.error && isAuthError && (
        <p className="mt-2 text-sm text-amber-700">
          Calendar access not granted.{" "}
          <strong>Sign out and sign back in</strong> with Google to enable
          Calendar sync.
        </p>
      )}

      {lastResult?.error && !isAuthError && (
        <p className="mt-2 text-sm text-red-600">{lastResult.error}</p>
      )}

      <div className="mt-4">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isSyncing ? "Syncing..." : "Sync Calendar"}
        </button>
      </div>
    </div>
  );
}
