"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  Graph,
  ArrowLeft,
  ArrowRight,
  Student,
  ChalkboardTeacher,
  CalendarCheck,
  Gear,
  X,
  Minus,
  Square,
  Compass,
} from "@phosphor-icons/react";
import { SnapshotWidget } from "./SnapshotWidget";
import { ActivityLogPanel } from "./ActivityLogPanel";
import { NotificationBell } from "./NotificationBell";
import { CalendarPanel } from "./calendar/CalendarPanel";

interface DashboardShellProps {
  children: ReactNode;
  onRestartTour?: () => void;
}

function WindowTitleBar() {
  return (
    <div className="relative h-10 border-b border-gray-300 bg-[#F6F6F6] flex items-center justify-between px-3 flex-shrink-0">
      <div className="flex items-center gap-1 text-gray-500">
        <Graph size={14} />
      </div>
      <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-bold text-gray-800">
        nodegent.app
      </span>
      {/* Decorative window controls */}
      <div className="flex items-center gap-3 text-gray-400 text-base">
        <Minus size={14} />
        <Square size={12} />
        <X size={14} />
      </div>
    </div>
  );
}

interface WindowToolbarProps {
  calendarOpen: boolean;
  onCalendarToggle: () => void;
  onHome: () => void;
  onRestartTour: () => void;
}

function SettingsPopover({ onRestartTour, onClose }: { onRestartTour: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-gray-200 bg-white shadow-lg z-50 py-1"
    >
      <button
        onClick={() => { onRestartTour(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left"
      >
        <Compass size={15} className="text-blue-500 flex-shrink-0" />
        Restart onboarding tour
      </button>
    </div>
  );
}

function WindowToolbar({ calendarOpen, onCalendarToggle, onHome, onRestartTour }: WindowToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-2 flex-shrink-0">
      {/* Nav arrows */}
      <button
        onClick={onHome}
        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-400"
        aria-label="Back"
      >
        <ArrowLeft size={14} weight="bold" />
      </button>
      <button className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-400 opacity-40 cursor-default">
        <ArrowRight size={14} weight="bold" />
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      {/* My Dashboard button */}
      <button
        id="tour-my-dashboard"
        onClick={onHome}
        className="flex items-center gap-1.5 px-2.5 py-1 border border-gray-300 rounded-sm hover:bg-gray-50 text-[13px]"
      >
        <Student size={14} weight="bold" className="text-[#CD8407]" />
        <span className="font-bold text-gray-800">My Dashboard</span>
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      {/* Toolbar icon buttons */}
      <button className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500">
        <ChalkboardTeacher size={16} weight="bold" />
      </button>
      <button
        onClick={onCalendarToggle}
        className={[
          "w-7 h-7 flex items-center justify-center rounded transition-colors",
          calendarOpen
            ? "bg-[#FFF3DC] text-[#CD8407]"
            : "hover:bg-gray-100 text-gray-500",
        ].join(" ")}
        aria-label="Toggle calendar"
        aria-pressed={calendarOpen}
      >
        <CalendarCheck size={16} weight="bold" />
      </button>
      <NotificationBell />

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              settingsOpen ? "bg-gray-100 text-gray-800" : "hover:bg-gray-100 text-gray-500"
            }`}
            aria-label="Settings"
            aria-expanded={settingsOpen}
          >
            <Gear size={16} weight="bold" />
          </button>
          {settingsOpen && (
            <SettingsPopover
              onRestartTour={onRestartTour}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>
        <button id="tour-connect-lms" className="brutal-border bg-[#3B82F6] text-white px-3 py-1 rounded-sm text-[12px] font-bold whitespace-nowrap">
          Connect LMS
        </button>
      </div>
    </div>
  );
}

function WindowStatusBar() {
  return (
    <div className="h-6 border-t border-gray-200 bg-[#EFEFEF] flex items-center justify-between px-3 text-[11px] text-gray-500 font-mono flex-shrink-0">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          LMS Sync Active
        </span>
        <span>Sprint: 2 In-Progress</span>
      </div>
      <div>Team: 5</div>
    </div>
  );
}

export function DashboardShell({ children, onRestartTour }: DashboardShellProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="desktop-bg min-h-screen overflow-hidden">
      <SnapshotWidget />
      <ActivityLogPanel />
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-[#EEEFE9] border-b border-gray-300 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-gray-900 rounded text-white">
              <Graph size={16} weight="bold" />
            </div>
            <span className="font-extrabold tracking-tight text-lg text-gray-900">Nodegent</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-[13px] font-semibold text-[#4D4F46]">
            <span id="tour-campus-sync" className="hover:text-black hover:underline underline-offset-4 decoration-gray-400 cursor-pointer">Campus Sync</span>
            <Link
              id="tour-ai-chat"
              href="/chat"
              className="hover:text-black hover:underline underline-offset-4 decoration-gray-400"
            >
              AI Chat
            </Link>
            <span id="tour-security" className="hover:text-black hover:underline underline-offset-4 decoration-gray-400 cursor-pointer">Security</span>
          </div>
        </div>
        <UserButton />
      </nav>

      {/* Main desktop area */}
      <main className="flex items-start justify-center pt-20 px-6 pb-6 min-h-screen">
        {/* OS Window */}
        <div className="window-shadow bg-white rounded-lg border border-gray-300 w-full max-w-3xl flex flex-col overflow-hidden relative">
          <WindowTitleBar />
          <WindowToolbar
            calendarOpen={calendarOpen}
            onCalendarToggle={() => setCalendarOpen((prev) => !prev)}
            onHome={() => setCalendarOpen(false)}
            onRestartTour={onRestartTour ?? (() => {})}
          />
          {/* Calendar panel — slides in below toolbar */}
          {calendarOpen && <CalendarPanel />}
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
            {children}
          </div>
          <WindowStatusBar />
        </div>
      </main>
    </div>
  );
}
