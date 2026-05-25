"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence } from "framer-motion";
import { api } from "@convex/_generated/api";
import { DashboardShell } from "./components/DashboardShell";
import { AssignmentList } from "./components/AssignmentList";
import { NewAssignmentsBanner } from "./components/NewAssignmentsBanner";
import { OnboardingTour } from "./components/OnboardingTour";
import { LoadingScreen } from "./components/LoadingScreen";

// Session-storage key used to ensure the OS-style loading screen (US-5.2)
// only appears on the FIRST dashboard mount of a browser session and is
// skipped for internal navigations within the same session.
const LOADING_SHOWN_KEY = "nodegent_loading_shown";

export function DashboardClient() {
  const { user, isLoaded } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const markOnboardingComplete = useMutation(api.users.markOnboardingComplete);
  const currentUser = useQuery(api.users.getCurrentUser);
  // Essential data signals for the loading screen — we wait until Convex has
  // returned (non-undefined) results for the queries the dashboard depends on.
  const courses = useQuery(api.courses.getCourses);
  const assignments = useQuery(api.assignments.getUpcomingAssignments);
  const hasSynced = useRef(false);

  // Fast-path: hide tour immediately for returning users without waiting for Convex
  const [showTour, setShowTour] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("nodegent_onboarding_done") !== "true";
  });

  // Loading-screen gate: only on the first dashboard mount per session.
  const [showLoading, setShowLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(LOADING_SHOWN_KEY) !== "true";
  });

  const essentialDataReady =
    isLoaded &&
    currentUser !== undefined &&
    courses !== undefined &&
    assignments !== undefined;

  // Once everything is ready, dismiss the loading screen and remember it for
  // the rest of the session. AnimatePresence handles the exit transition.
  useEffect(() => {
    if (showLoading && essentialDataReady) {
      sessionStorage.setItem(LOADING_SHOWN_KEY, "true");
      setShowLoading(false);
    }
  }, [showLoading, essentialDataReady]);

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

  return (
    <>
      {isLoaded && (
        <DashboardShell onRestartTour={handleRestartTour}>
          <NewAssignmentsBanner />
          <AssignmentList />
        </DashboardShell>
      )}
      {isLoaded && showTour && currentUser !== undefined && !showLoading && (
        <OnboardingTour onComplete={handleTourComplete} />
      )}
      <AnimatePresence>
        {showLoading && <LoadingScreen key="loading-screen" />}
      </AnimatePresence>
    </>
  );
}


