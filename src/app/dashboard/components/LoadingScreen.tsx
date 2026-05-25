"use client";

import { motion } from "framer-motion";
import { Graph } from "@phosphor-icons/react";

/**
 * Fullscreen OS-style loading screen (US-5.2).
 *
 * Mounted by `DashboardClient` on the FIRST dashboard load of a session
 * and stays in view until essential Convex data (user, courses, assignments)
 * has finished loading. Exit fade-out is handled by the parent's
 * <AnimatePresence> wrapper.
 *
 * Design intent: minimal macOS-style boot screen — dark background, centered
 * wordmark, and a subtle horizontal progress bar that pulses while data
 * streams in. No spinner.
 */
export function LoadingScreen() {
  return (
    <motion.div
      // Stays on top of everything (above DashboardShell's nav at z-50)
      className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-[#0B0B0E] text-white"
      // Enter is essentially instant — the value is on EXIT, which happens
      // once Convex queries resolve. Parent wraps in <AnimatePresence>.
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeOut" } }}
      role="status"
      aria-live="polite"
      aria-label="Loading Nodegent"
    >
      {/* Centered logo + wordmark group */}
      <motion.div
        className="flex flex-col items-center gap-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 backdrop-blur-sm ring-1 ring-white/10">
          <Graph size={28} weight="bold" className="text-white" />
        </div>
        <div className="flex items-baseline gap-[2px]">
          <span className="font-sans text-3xl font-medium tracking-tight text-white">
            Nodegen
          </span>
          <span className="font-sans text-3xl font-medium tracking-tight bg-gradient-to-r from-[#EB9D2A] to-[#CD8407] bg-clip-text text-transparent">
            t
          </span>
        </div>
      </motion.div>

      {/* Subtle progress bar — indeterminate animation */}
      <div
        className="mt-10 h-[2px] w-48 overflow-hidden rounded-full bg-white/10"
        aria-hidden="true"
      >
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "300%" }}
          transition={{
            duration: 1.6,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 0.1,
          }}
        />
      </div>

      <p className="mt-6 text-[11px] font-mono uppercase tracking-[0.25em] text-white/40">
        Loading your campus
      </p>
    </motion.div>
  );
}
