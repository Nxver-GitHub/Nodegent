"use client";

import { motion } from "framer-motion";
import { Graph } from "@phosphor-icons/react";

interface LoadingScreenProps {
  /**
   * Display variant. `"welcome"` is shown on a user's first dashboard load
   * (account was just created) and lingers longer with a personalized greeting,
   * macOS-boot style. `"boot"` is the regular per-session loading screen.
   */
  mode?: "welcome" | "boot";
  /** First name pulled from Clerk — only used in `"welcome"` mode. */
  firstName?: string | null;
}

/**
 * Fullscreen OS-style loading screen (US-5.2).
 *
 * Mounted by `DashboardClient` on the FIRST dashboard load of a session
 * and stays in view until BOTH (a) essential Convex data has loaded and
 * (b) a minimum display duration has elapsed (set by the parent).
 *
 * Design intent: minimal macOS-style boot screen — dark background, centered
 * wordmark, and a horizontal progress bar. In welcome mode the screen is
 * larger, slower, and personalized; otherwise it stays subtle.
 */
export function LoadingScreen({ mode = "boot", firstName }: LoadingScreenProps) {
  const isWelcome = mode === "welcome";

  // The progress bar fills from 0 → 100% over this duration. We let it linger
  // slightly past 100% before the parent unmounts us so it never visibly
  // "snaps" away. Min display durations live in DashboardClient.
  const progressDurationSec = isWelcome ? 4.2 : 1.7;

  return (
    <motion.div
      // Stays on top of everything (above DashboardShell's nav at z-50)
      className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-[#0B0B0E] text-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.55, ease: "easeOut" } }}
      role="status"
      aria-live="polite"
      aria-label={isWelcome ? "Welcome to Nodegent" : "Loading Nodegent"}
    >
      {/* Logo */}
      <motion.div
        className={`flex items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm ${
          isWelcome ? "h-20 w-20" : "h-14 w-14"
        }`}
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: isWelcome ? 0.9 : 0.55,
          ease: "easeOut",
        }}
      >
        <Graph size={isWelcome ? 36 : 28} weight="bold" className="text-white" />
      </motion.div>

      {/* Personalized welcome OR plain wordmark */}
      {isWelcome ? (
        <motion.div
          className="mt-8 flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-balance text-center text-3xl font-medium tracking-tight text-white sm:text-4xl">
            {firstName ? `Welcome, ${firstName}.` : "Welcome to Nodegent."}
          </h1>
          <p className="text-[13px] text-white/55">
            Setting up your campus desktop…
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="mt-6 flex items-baseline gap-[2px]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
        >
          <span className="font-sans text-3xl font-medium tracking-tight text-white">
            Nodegen
          </span>
          <span className="bg-gradient-to-r from-[#EB9D2A] to-[#CD8407] bg-clip-text font-sans text-3xl font-medium tracking-tight text-transparent">
            t
          </span>
        </motion.div>
      )}

      {/* Determinate progress bar — fills from 0% to 100% over `progressDurationSec` */}
      <div
        className={`mt-10 overflow-hidden rounded-full bg-white/10 ${
          isWelcome ? "h-[3px] w-72" : "h-[2px] w-52"
        }`}
        aria-hidden="true"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-white/70 via-white to-white/70"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{
            duration: progressDurationSec,
            ease: "easeInOut",
          }}
        />
      </div>

      {!isWelcome && (
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">
          Loading your campus
        </p>
      )}
    </motion.div>
  );
}
