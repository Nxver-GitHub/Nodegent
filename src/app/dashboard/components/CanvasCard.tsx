"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { CanvasAuthViewer } from "./CanvasAuthViewer";

export function CanvasCard() {
  const status = useQuery(api.canvas.getCanvasStatus);
  const syncCanvas = useAction(api.canvas.syncCanvas);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await syncCanvas({});
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  if (status === undefined) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-gray-500">Loading Canvas status...</p>
      </div>
    );
  }

  if (!status?.isConnected) {
    return <CanvasAuthViewer onConnected={handleSync} />;
  }

  const lastSync = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString()
    : "Never";

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Canvas</h3>
        <span className="text-sm font-medium text-green-600">Connected</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{status.canvasBaseUrl}</p>
      <p className="mt-2 text-sm text-gray-600">
        Last sync: {lastSync}
        {status.coursesSynced !== undefined && (
          <>
            {" "}
            · {status.coursesSynced} courses · {status.assignmentsSynced ?? 0} assignments
          </>
        )}
      </p>
      {status.lastSyncStatus === "error" && (status.lastSyncError ?? syncError) && (
        <p className="mt-2 text-sm text-red-600">
          Sync error: {status.lastSyncError ?? syncError}
        </p>
      )}
      {syncError && status.lastSyncStatus !== "error" && (
        <p className="mt-2 text-sm text-red-600">Sync error: {syncError}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isSyncing ? "Syncing..." : "Sync Now"}
        </button>
      </div>
    </div>
  );
}
