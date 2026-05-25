"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Graph,
  Student,
  ChalkboardTeacher,
  CalendarCheck,
  ChatCircleText,
  BellRinging,
  Gear,
  Warning,
  BookBookmark,
  PaperPlaneTilt,
} from "@phosphor-icons/react";

type TabKey = "dashboard" | "calendar" | "chat";
const TAB_ORDER: TabKey[] = ["dashboard", "calendar", "chat"];
const AUTO_CYCLE_MS = 4200;

const MOCK_ASSIGNMENTS = [
  {
    badge: "Overdue",
    badgeBg: "bg-[#F34D52]",
    course: "CSE-160-01",
    title: "Lighting & Shading Lab",
    due: "Due 2 days ago",
    iconColor: "text-[#F34D52]",
    icon: "warning" as const,
  },
  {
    badge: "Due Today",
    badgeBg: "bg-[#EB9D2A]",
    course: "CSE-115A",
    title: "Sprint 4 Demo Prep",
    due: "Due 5:00 PM",
    iconColor: "text-[#EB9D2A]",
    icon: "warning" as const,
  },
  {
    badge: "This Week",
    badgeBg: "bg-[#CD8407]",
    course: "MATH-19A",
    title: "Problem Set 7",
    due: "Due Friday · 11:59 PM",
    iconColor: "text-[#CD8407]",
    icon: "book" as const,
  },
];

const WEEK_DAYS = [
  { label: "Mon", date: 18, accent: null as string | null, event: null as string | null },
  { label: "Tue", date: 19, accent: "#F34D52", event: "CSE-160 lab" },
  { label: "Wed", date: 20, accent: null, event: null },
  { label: "Thu", date: 21, accent: "#EB9D2A", event: "Sprint 4 demo" },
  { label: "Fri", date: 22, accent: "#CD8407", event: "MATH pset" },
];

const TAB_VARIANTS = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export function DashboardMockup() {
  const [active, setActive] = useState<TabKey>("dashboard");
  const interactedRef = useRef(false);

  // Auto-cycle through tabs until the visitor clicks one themselves.
  useEffect(() => {
    if (interactedRef.current) return;
    const t = window.setInterval(() => {
      if (interactedRef.current) return;
      setActive((curr) => {
        const i = TAB_ORDER.indexOf(curr);
        return TAB_ORDER[(i + 1) % TAB_ORDER.length];
      });
    }, AUTO_CYCLE_MS);
    return () => window.clearInterval(t);
  }, []);

  function pick(tab: TabKey) {
    interactedRef.current = true;
    setActive(tab);
  }

  return (
    <div className="brutal-border-lg window-shadow w-full max-w-xl overflow-hidden rounded-lg bg-white">
      {/* Title bar */}
      <div className="relative flex h-9 items-center justify-between border-b border-gray-300 bg-[#F6F6F6] px-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#F34D52]" />
          <span className="h-3 w-3 rounded-full bg-[#EB9D2A]" />
          <span className="h-3 w-3 rounded-full bg-[#7CC36E]" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[12px] font-bold text-gray-800">
          nodegent.app
        </span>
        <Graph size={14} className="text-gray-500" />
      </div>

      {/* Toolbar — interactive tabs */}
      <div className="flex h-10 items-center gap-1.5 border-b border-gray-200 bg-white px-3">
        <TabButton
          active={active === "dashboard"}
          onClick={() => pick("dashboard")}
          icon={<Student size={12} weight="bold" />}
          label="Dashboard"
        />
        <TabButton
          active={active === "calendar"}
          onClick={() => pick("calendar")}
          icon={<CalendarCheck size={12} weight="bold" />}
          label="Calendar"
        />
        <TabButton
          active={active === "chat"}
          onClick={() => pick("chat")}
          icon={<ChatCircleText size={12} weight="bold" />}
          label="AI Chat"
        />
        <div className="ml-auto flex items-center gap-2">
          <ChalkboardTeacher size={14} weight="bold" className="text-gray-400" />
          <BellRinging size={14} weight="bold" className="text-gray-400" />
          <Gear size={14} weight="bold" className="text-gray-400" />
        </div>
      </div>

      {/* Content — animated transition between tabs */}
      <div className="relative min-h-[260px]">
        <AnimatePresence mode="wait">
          {active === "dashboard" && (
            <motion.div
              key="dashboard"
              variants={TAB_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-3 p-4"
            >
              <div>
                <p className="text-[15px] font-extrabold text-gray-900">
                  Good afternoon, Surya
                </p>
                <p className="text-[11px] text-[#6B6D63]">Wednesday · May 25</p>
              </div>
              <div className="space-y-2">
                {MOCK_ASSIGNMENTS.map((a) => (
                  <div
                    key={a.title}
                    className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className={`${a.iconColor} flex-shrink-0`}>
                      {a.icon === "warning" ? (
                        <Warning size={16} weight="fill" />
                      ) : (
                        <BookBookmark size={16} weight="fill" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-[#6B6D63]">
                        {a.course}
                      </p>
                      <p className="truncate text-[12px] font-bold text-gray-900">
                        {a.title}
                      </p>
                    </div>
                    <span
                      className={`${a.badgeBg} flex-shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white`}
                    >
                      {a.badge}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {active === "calendar" && (
            <motion.div
              key="calendar"
              variants={TAB_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-3 p-4"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[15px] font-extrabold text-gray-900">May 2026</p>
                <p className="text-[11px] text-[#6B6D63]">Week 21</p>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {WEEK_DAYS.map((d) => (
                  <div
                    key={d.label}
                    className={`flex flex-col items-center gap-0.5 rounded-md border bg-white px-1.5 py-2 ${
                      d.accent ? "border-gray-300" : "border-gray-200"
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B6D63]">
                      {d.label}
                    </span>
                    <span className="text-base font-extrabold text-gray-900">{d.date}</span>
                    {d.accent && (
                      <span
                        className="mt-0.5 h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: d.accent }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-gray-200 bg-[#FFF6E8] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#CD8407]">
                  Thursday · May 21
                </p>
                <p className="text-[12px] font-bold text-gray-900">
                  CSE-115A — Sprint 4 demo, 5:00 PM
                </p>
                <p className="mt-0.5 text-[11px] text-gray-700">
                  Pushed to your Google Calendar.
                </p>
              </div>
            </motion.div>
          )}

          {active === "chat" && (
            <motion.div
              key="chat"
              variants={TAB_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-2.5 p-4"
            >
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-lg bg-[#1D1D1D] px-3 py-1.5 text-[12px] text-white">
                  What’s due this week?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] text-gray-900">
                  You have <span className="font-bold">3 items</span> due this week:
                  a lab for <span className="font-bold">CSE-160</span> (Tue), the
                  Sprint 4 demo for <span className="font-bold">CSE-115A</span> (Thu),
                  and a problem set for <span className="font-bold">MATH-19A</span>{" "}
                  (Fri).
                </div>
              </div>
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <span
                    className="dot-pulse h-1.5 w-1.5 rounded-full bg-gray-500"
                    style={{ animationDelay: "0s" }}
                  />
                  <span
                    className="dot-pulse h-1.5 w-1.5 rounded-full bg-gray-500"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="dot-pulse h-1.5 w-1.5 rounded-full bg-gray-500"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                <span className="flex-1 text-[11px] text-gray-400">
                  Ask Nodegent anything…
                </span>
                <PaperPlaneTilt size={14} weight="bold" className="text-[#CD8407]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-gray-200 bg-[#EFEFEF] px-3 font-mono text-[10px] text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="blink inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
            LMS Sync Active
          </span>
          <span className="hidden sm:inline">Sprint: 2 In-Progress</span>
        </div>
        <span>Team: 5</span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 transition-colors ${
        active
          ? "border-gray-800 bg-[#FFF3DC] text-[#1D1D1D]"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50"
      }`}
      aria-pressed={active}
    >
      <span className={active ? "text-[#CD8407]" : "text-gray-500"}>{icon}</span>
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}
