"use client";

import React, { useEffect, useRef, useState } from "react";
import { useUser, useSession } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence } from "framer-motion";
import { api } from "@convex/_generated/api";
import { useAutoSync } from "@/hooks/useAutoSync";
import { DashboardShell } from "./components/DashboardShell";
import { AssignmentList } from "./components/AssignmentList";
import { NewAssignmentsBanner } from "./components/NewAssignmentsBanner";
import { SnapshotPanel } from "./components/SnapshotPanel";
import { SchedulePanel } from "./components/SchedulePanel";
import type { WidgetConfig } from "@/hooks/useWidgetLayout";
import { OnboardingTour } from "./components/OnboardingTour";
import { LoadingScreen } from "./components/LoadingScreen";

// SessionStorage key for the loading-screen gate. We key by Clerk's session.id
// so a fresh sign-in (new session) always re-shows the loading screen, while
// internal navigations within the same authenticated session skip it.
const LOADING_SHOWN_SESSION_KEY = "nodegent_loading_shown_session_id";

// Minimum display durations — prevents the loading screen from disappearing
// before the user can actually see it. Welcome (first-ever sign-in) lingers
// longer like macOS first boot; the per-login boot screen is shorter.
const MIN_DURATION_WELCOME_MS = 4500;
const MIN_DURATION_BOOT_MS = 1800;

// Window for treating a freshly-created user as "first-time" — if the user
// record was created within the last minute, we show the welcome variant.
const FIRST_TIME_WINDOW_MS = 60_000;

export function DashboardClient() {
  const { user, isLoaded } = useUser();
  const { session, isLoaded: sessionLoaded } = useSession();
  const ensureUser = useMutation(api.users.ensureUser);
  const markOnboardingComplete = useMutation(api.users.markOnboardingComplete);
  const currentUser = useQuery(api.users.getCurrentUser);
  // Essential data signals for the loading screen — we wait until Convex has
  // returned (non-undefined) results for the queries the dashboard depends on.
  const courses = useQuery(api.courses.getCourses);
  const assignments = useQuery(api.assignments.getUpcomingAssignments);
  const hasSynced = useRef(false);
  const loadingStartedAtRef = useRef<number>(Date.now());

  // Fast-path: hide tour immediately for returning users without waiting for Convex
  const [showTour, setShowTour] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("nodegent_onboarding_done") !== "true";
  });

  // Loading screen gate. Initialize false; we promote to true once we know
  // the current Clerk session.id and confirm it's NOT the one we last loaded for.
  const [showLoading, setShowLoading] = useState(false);

  // Tracks whether the minimum display duration has elapsed. The timer is
  // armed once we know which mode (welcome vs boot) we're in.
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);

  const sessionId = session?.id ?? null;

  useAutoSync({ sessionId, user: currentUser ?? null });

  // Decide whether to surface the loading screen for this Clerk session.
  // Runs once Clerk has resolved — if the stored session id differs from
  // (or is missing relative to) the current one, this is a fresh login.
  useEffect(() => {
    if (!sessionLoaded) return;
    if (typeof window === "undefined") return;
    if (!sessionId) return;

    const stored = sessionStorage.getItem(LOADING_SHOWN_SESSION_KEY);
    if (stored !== sessionId) {
      loadingStartedAtRef.current = Date.now();
      setShowLoading(true);
    }
  }, [sessionLoaded, sessionId]);

  // First-time signal: account was just created (within the welcome window).
  // We only treat the user as first-time once `currentUser` has resolved.
  const isFirstTime =
    !!currentUser &&
    Date.now() - currentUser.createdAt < FIRST_TIME_WINDOW_MS;
  const loadingMode: "welcome" | "boot" = isFirstTime ? "welcome" : "boot";

  const essentialDataReady =
    isLoaded &&
    currentUser !== undefined &&
    courses !== undefined &&
    assignments !== undefined;

  // Arm the min-duration timer once the loading screen is actually visible
  // AND we know whether to use welcome or boot timing.
  useEffect(() => {
    if (!showLoading) return;
    if (currentUser === undefined) return;

    const targetMs = isFirstTime ? MIN_DURATION_WELCOME_MS : MIN_DURATION_BOOT_MS;
    const elapsed = Date.now() - loadingStartedAtRef.current;
    const remaining = Math.max(0, targetMs - elapsed);

    if (remaining === 0) {
      setMinDurationElapsed(true);
      return;
    }

    const t = window.setTimeout(() => setMinDurationElapsed(true), remaining);
    return () => window.clearTimeout(t);
  }, [showLoading, currentUser, isFirstTime]);

  // Dismiss only when BOTH data is ready AND the min duration has elapsed.
  // Persist the session id so internal navigations skip the loading screen.
  useEffect(() => {
    if (showLoading && essentialDataReady && minDurationElapsed && sessionId) {
      sessionStorage.setItem(LOADING_SHOWN_SESSION_KEY, sessionId);
      setShowLoading(false);
    }
  }, [showLoading, essentialDataReady, minDurationElapsed, sessionId]);

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

  // While Clerk is still resolving and the loading screen is suppressed for
  // this session, show a minimal fallback so we never render a broken shell.
  if (!isLoaded && !showLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center desktop-bg">
        <p className="text-[#4D4F46] text-sm font-medium">Loading...</p>
      </div>
    );
  }

  function renderWidgets(layout: WidgetConfig[]) {
    const widgetMap: Record<string, React.ReactNode> = {
      snapshot: <SnapshotPanel key="snapshot" />,
      assignments: <AssignmentList key="assignments" />,
      schedule: <SchedulePanel key="schedule" />,
    };
    return (
      <div className="flex flex-col gap-6">
        <NewAssignmentsBanner />
        {layout
          .filter((w) => w.visible)
          .map((w) => widgetMap[w.id])}
      </div>
    );
  }

  return (
    <>
      {isLoaded && (
        <DashboardShell onRestartTour={handleRestartTour}>
          {renderWidgets}
        </DashboardShell>
      )}
      {isLoaded && showTour && currentUser !== undefined && !showLoading && (
        <OnboardingTour onComplete={handleTourComplete} />
      )}
      <AnimatePresence>
        {showLoading && (
          <LoadingScreen
            key="loading-screen"
            mode={loadingMode}
            firstName={user?.firstName ?? null}
          />
        )}
      </AnimatePresence>
    </>
  );
}
