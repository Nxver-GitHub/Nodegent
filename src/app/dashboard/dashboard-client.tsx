"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { DashboardShell } from "./components/DashboardShell";
import { AssignmentList } from "./components/AssignmentList";
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
        <NewAssignmentsBanner />
        <AssignmentList />
      </DashboardShell>
      {showTour && currentUser !== undefined && (
        <OnboardingTour onComplete={handleTourComplete} />
      )}
    </>
  );
}


