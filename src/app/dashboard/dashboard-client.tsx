"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { DashboardShell } from "./components/DashboardShell";
import { AssignmentList } from "./components/AssignmentList";
import { CanvasAuthViewer } from "./components/CanvasAuthViewer";
import { GoogleCalendarCard } from "./components/GoogleCalendarCard";
import { AccessToggleCard } from "./components/AccessToggleCard";

export function DashboardClient() {
  const { user, isLoaded } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (isLoaded && user && !hasSynced.current) {
      hasSynced.current = true;
      ensureUser();
    }
  }, [isLoaded, user, ensureUser]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center desktop-bg">
        <p className="text-[#4D4F46] text-sm font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <DashboardShell>
      <CanvasCard />
      <GoogleCalendarCard />
      <AssignmentList />
      <AccessToggleCard />
    </DashboardShell>
  );
}

function CanvasCard() {
  const status = useQuery(api.canvas.getCanvasStatus);
  const removeCredentials = useMutation(api.canvas.removeCanvasCredentials);
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

  async function handleDisconnect() {
    await removeCredentials({});
  }

  // Loading
  if (status === undefined) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-gray-500">Loading Canvas status...</p>
      </div>
    );
  }

  // Not connected — show SSO auth viewer
  if (!status?.isConnected) {
    return <CanvasAuthViewer onConnected={handleSync} />;
  }

  // Connected — show status and sync controls
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
            · {status.coursesSynced} courses · {status.assignmentsSynced ?? 0}{" "}
            assignments
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
        <button
          onClick={handleDisconnect}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
