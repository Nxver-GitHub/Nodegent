"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { DashboardShell } from "./components/DashboardShell";
import { AssignmentList } from "./components/AssignmentList";

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
      <AssignmentList />
    </DashboardShell>
  );
}

function CanvasCard() {
  const status = useQuery(api.canvas.getCanvasStatus);
  const saveToken = useMutation(api.canvas.saveCanvasToken);
  const removeToken = useMutation(api.canvas.removeCanvasToken);
  const syncCanvas = useAction(api.canvas.syncCanvas);

  const [canvasUrl, setCanvasUrl] = useState("https://ucsc.instructure.com");
  const [accessToken, setAccessToken] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isConnected = status !== null && status !== undefined;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await saveToken({ accessToken, canvasBaseUrl: canvasUrl });
      setAccessToken("");
      await handleSync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save token");
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      await syncCanvas({});
    } catch {
      // Error is persisted to lastSyncError in Convex — UI reads it from status
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnect() {
    await removeToken({});
  }

  // status === undefined means query is loading; null means no credentials saved
  if (status === undefined) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-gray-500">Loading Canvas status...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-semibold text-gray-900">Connect Canvas</h3>
        <p className="mt-1 text-sm text-gray-500">
          Enter your Canvas personal access token to sync your courses and
          assignments. Generate one in Canvas → Account → Settings → Approved
          Integrations → New Access Token.
        </p>
        <form onSubmit={handleConnect} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Canvas URL
            </label>
            <input
              type="url"
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://ucsc.instructure.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste your Canvas access token"
              required
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Connect Canvas
          </button>
        </form>
      </div>
    );
  }

  const lastSync = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString()
    : "Never";

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Canvas</h3>
        <span className="text-sm text-green-600 font-medium">Connected</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{status.canvasBaseUrl}</p>
      <p className="mt-2 text-sm text-gray-600">
        Last sync: {lastSync}
        {status.coursesSynced !== undefined && (
          <>
            {" "}
            · {status.coursesSynced} courses ·{" "}
            {status.assignmentsSynced ?? 0} assignments
          </>
        )}
      </p>
      {status.lastSyncStatus === "error" && status.lastSyncError && (
        <p className="mt-2 text-sm text-red-600">
          Sync error: {status.lastSyncError}
        </p>
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
