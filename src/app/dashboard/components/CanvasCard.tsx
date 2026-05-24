"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { CanvasAuthViewer } from "./CanvasAuthViewer";

export function CanvasCard() {
  const status = useQuery(api.canvas.getCanvasStatus);
  const syncCanvas = useAction(api.canvas.syncCanvas);
  const searchParams = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Auto-open the SSO viewer when the snapshot widget (or anyone else) links
  // here with ?reconnect=canvas and the server still considers us expired.
  useEffect(() => {
    if (
      searchParams.get("reconnect") === "canvas" &&
      status?.needsReconnect === true
    ) {
      setIsReconnecting(true);
    }
  }, [searchParams, status?.needsReconnect]);

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

  const needsReconnect = status.needsReconnect === true;

  return (
    <div id="canvas-card" className="rounded-lg border bg-white p-6 scroll-mt-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Canvas</h3>
        <span
          className={`text-sm font-medium ${
            needsReconnect ? "text-amber-600" : "text-green-600"
          }`}
        >
          {needsReconnect ? "Session expired" : "Connected"}
        </span>
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
      {!isReconnecting && (
        <div className="mt-4 flex gap-3">
          {needsReconnect ? (
            <button
              onClick={() => setIsReconnecting(true)}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Reconnect Canvas
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          )}
        </div>
      )}
      {isReconnecting && (
        <div className="mt-4">
          <CanvasAuthViewer
            onConnected={() => {
              setIsReconnecting(false);
              void handleSync();
            }}
          />
        </div>
      )}
    </div>
  );
}
