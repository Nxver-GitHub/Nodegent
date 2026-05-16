"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { DashboardShell } from "./components/DashboardShell";
import { AssignmentList } from "./components/AssignmentList";
import { CanvasAuthViewer } from "./components/CanvasAuthViewer";
import { GoogleCalendarCard } from "./components/GoogleCalendarCard";
import { NewAssignmentsBanner } from "./components/NewAssignmentsBanner";
import { OnboardingTour } from "./components/OnboardingTour";

export function DashboardClient() {
  const { user, isLoaded } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const markOnboardingComplete = useMutation(api.users.markOnboardingComplete);
  const currentUser = useQuery(api.users.getCurrentUser);
  const hasSynced = useRef(false);

  // Fast-path: hide tour immediately for returning users without waiting for Convex
  const [showTour, setShowTour] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("nodegent_onboarding_done") !== "true";
  });

  useEffect(() => {
    if (isLoaded && user && !hasSynced.current) {
      hasSynced.current = true;
      ensureUser();
    }
  }, [isLoaded, user, ensureUser]);

  // Sync with Convex: once confirmed complete, cache locally
  useEffect(() => {
    if (currentUser?.onboardingCompleted) {
      sessionStorage.setItem("nodegent_onboarding_done", "true");
      setShowTour(false);
    }
  }, [currentUser?.onboardingCompleted]);

  async function handleTourComplete() {
    sessionStorage.setItem("nodegent_onboarding_done", "true");
    setShowTour(false);
    try {
      await markOnboardingComplete();
    } catch {
      // Non-critical — tour is already hidden locally
    }
  }

  function handleRestartTour() {
    sessionStorage.removeItem("nodegent_onboarding_done");
    setShowTour(true);
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center desktop-bg">
        <p className="text-[#4D4F46] text-sm font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <DashboardShell onRestartTour={handleRestartTour}>
        <CanvasCard />
        <GoogleCalendarCard />
        <NewAssignmentsBanner />
        <AssignmentList />
      </DashboardShell>
      {showTour && currentUser !== undefined && (
        <OnboardingTour onComplete={handleTourComplete} />
      )}
    </>
  );
}

function CanvasCard() {
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
      </div>
    </div>
  );
}
