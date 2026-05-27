"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
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
  Sun,
  Moon,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useAutoSyncPreference } from "@/hooks/useAutoSyncPreference";
import { SnapshotWidget } from "./SnapshotWidget";
import { ActivityLogPanel } from "./ActivityLogPanel";
import { NotificationBell } from "./NotificationBell";
import { CalendarPanel } from "./calendar/CalendarPanel";
import { SecurityPanel } from "./security/SecurityPanel";
import { CampusSyncPanel } from "./campus-sync/CampusSyncPanel";
import { CoursesPanel } from "./courses/CoursesPanel";
import dynamic from "next/dynamic";
import { AppDock } from "./dock/AppDock";
import { DEFAULT_APPS, type DockApp, type DockAppId } from "./dock/dockConfig";

const IframeWindow = dynamic(
  () => import("./dock/IframeWindow").then((m) => m.IframeWindow),
  { ssr: false }
);

const DraggableWindow = dynamic(
  () => import("./dock/DraggableWindow").then((m) => m.DraggableWindow),
  { ssr: false }
);
import { type ReactNode as RN } from "react";

const CONNECT_CANVAS_DISMISSED_KEY = "nodegent-connect-canvas-banner-dismissed";

function ConnectCanvasBanner({ onConnect }: { onConnect: (mode: "connect" | "reconnect") => void }) {
  const status = useQuery(api.canvas.getCanvasStatus);
  const user = useQuery(api.users.getCurrentUser);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(CONNECT_CANVAS_DISMISSED_KEY) === "1";
  });

  function handleDismiss() {
    sessionStorage.setItem(CONNECT_CANVAS_DISMISSED_KEY, "1");
    setDismissed(true);
  }

  if (dismissed) return null;
  if (status === undefined || user === undefined) return null;
  if (user?.canvasEnabled === false) return null;

  const isNotConnected = status === null;
  const needsReconnect = status !== null && status.needsReconnect === true;
  if (!isNotConnected && !needsReconnect) return null;

  const title = isNotConnected ? "Connect Canvas" : "Canvas session expired";
  const subtitle = isNotConnected
    ? "Sign in once with your CruzID to pull in your courses and assignments."
    : "Sign back in with your CruzID to keep your courses and assignments in sync.";
  const buttonLabel = isNotConnected ? "Connect" : "Reconnect";
  const mode: "connect" | "reconnect" = isNotConnected ? "connect" : "reconnect";

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900">{title}</p>
        <p className="text-xs text-amber-800 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onConnect(mode)}
          className="rounded-sm bg-[#CD8407] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#A86A05] transition-colors"
        >
          {buttonLabel}
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="rounded p-1 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function Tooltip({ label, children }: { label: string; children: RN }) {
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded bg-gray-800 px-2 py-1 text-[11px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}

interface DashboardShellProps {
  children: ReactNode;
  onRestartTour?: () => void;
}

function WindowTitleBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative h-10 border-b border-gray-300 bg-[#F6F6F6] flex items-center justify-between px-3 flex-shrink-0">
      <div className="flex items-center gap-1 text-gray-500">
        <Graph size={14} />
      </div>
      <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-bold text-gray-800">
        nodegent.app
      </span>
      <div className="flex items-center gap-3 text-gray-400 text-base">
        <Minus size={14} />
        <Square size={12} />
        <button
          onClick={onClose}
          aria-label="Close Nodegent"
          className="hover:text-red-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

interface WindowToolbarProps {
  calendarOpen: boolean;
  onCalendarToggle: () => void;
  onBack: () => void;
  onHome: () => void;
  onCampusSync: () => void;
  onCourses: () => void;
  onRestartTour: () => void;
}

function SettingsPopover({ onRestartTour, onClose }: { onRestartTour: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { autoSyncEnabled, setAutoSyncEnabled } = useAutoSyncPreference();

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
      className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-gray-200 bg-white shadow-lg z-50 py-1"
    >
      <button
        onClick={toggleTheme}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left"
      >
        {theme === "dark" ? (
          <Sun size={15} className="text-yellow-500 flex-shrink-0" />
        ) : (
          <Moon size={15} className="text-indigo-500 flex-shrink-0" />
        )}
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </button>

      <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 text-[13px] text-gray-700">
        <div className="flex items-center gap-2.5 min-w-0">
          <ArrowsClockwise size={15} weight="bold" className="text-emerald-500 flex-shrink-0" />
          <span className="truncate">Auto-sync on login</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoSyncEnabled}
          aria-label="Toggle auto-sync on login"
          onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
            autoSyncEnabled ? "bg-emerald-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              autoSyncEnabled ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

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

function WindowToolbar({ calendarOpen, onCalendarToggle, onBack, onHome, onCampusSync, onCourses, onRestartTour }: WindowToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-2 flex-shrink-0">
      <Tooltip label="Back">
        <button
          onClick={onBack}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-400"
          aria-label="Back"
        >
          <ArrowLeft size={14} weight="bold" />
        </button>
      </Tooltip>
      <button className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-400 opacity-40 cursor-default">
        <ArrowRight size={14} weight="bold" />
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      <Link
        id="tour-my-dashboard"
        href="/dashboard"
        onClick={onHome}
        className="flex items-center gap-1.5 px-2.5 py-1 border border-gray-300 rounded-sm hover:bg-gray-50 text-[13px]"
      >
        <Student size={14} weight="bold" className="text-[#CD8407]" />
        <span className="font-bold text-gray-800">My Dashboard</span>
      </Link>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      <Tooltip label="My Courses">
        <button
          onClick={onCourses}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500"
          aria-label="My Courses"
        >
          <ChalkboardTeacher size={16} weight="bold" />
        </button>
      </Tooltip>
      <Tooltip label="Calendar">
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
      </Tooltip>
      <Tooltip label="Notifications">
        <NotificationBell />
      </Tooltip>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Tooltip label="Settings">
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
          </Tooltip>
          {settingsOpen && (
            <SettingsPopover
              onRestartTour={onRestartTour}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>
        <button id="tour-connect-lms" onClick={onCampusSync} className="brutal-border bg-[#3B82F6] text-white px-3 py-1 rounded-sm text-[12px] font-bold whitespace-nowrap">
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
  const router = useRouter();
  const pathname = usePathname();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [campusSyncOpen, setCampusSyncOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [activeDockApp, setActiveDockApp] = useState<DockAppId | null>("nodegent");

  // Derived: which iframe app is currently open (if any)
  const iframeApp = activeDockApp
    ? (DEFAULT_APPS.find((a) => a.id === activeDockApp && a.appType === "iframe") ?? null)
    : null;

  function openCourses() {
    setCoursesOpen(true);
    setSecurityOpen(false);
    setCampusSyncOpen(false);
    setCalendarOpen(false);
  }

  function openCampusSync() {
    setCampusSyncOpen(true);
    setCoursesOpen(false);
    setSecurityOpen(false);
    setCalendarOpen(false);
  }

  function openCampusSyncForCanvas(mode: "connect" | "reconnect") {
    openCampusSync();
    if (mode === "reconnect") {
      router.replace(`${pathname}?reconnect=canvas`, { scroll: false });
    }
  }

  function openSecurity() {
    setSecurityOpen(true);
    setCampusSyncOpen(false);
    setCoursesOpen(false);
    setCalendarOpen(false);
  }

  function goHome() {
    setSecurityOpen(false);
    setCampusSyncOpen(false);
    setCoursesOpen(false);
    setCalendarOpen(false);
  }

  function handleBack() {
    if (calendarOpen && (coursesOpen || campusSyncOpen || securityOpen)) {
      setCalendarOpen(false);
    } else {
      goHome();
    }
  }

  function handleDockAppClick(app: DockApp) {
    if (app.appType === "external") {
      window.open(app.url!, "_blank", "noopener,noreferrer");
      return;
    }
    if (app.appType === "iframe") {
      setActiveDockApp(app.id);
      return;
    }
    // internal (nodegent) — open dashboard, close any iframe
    setActiveDockApp("nodegent");
  }

  const isDashboard = !securityOpen && !campusSyncOpen && !coursesOpen;

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
            <Link
              href="/dashboard"
              onClick={goHome}
              className={[
                "hover:text-black hover:underline underline-offset-4 decoration-gray-400",
                isDashboard ? "text-black underline" : "",
              ].join(" ")}
            >
              Dashboard
            </Link>
            <button
              id="tour-campus-sync"
              type="button"
              onClick={openCampusSync}
              className={[
                "hover:text-black hover:underline underline-offset-4 decoration-gray-400",
                campusSyncOpen ? "text-black underline" : "",
              ].join(" ")}
            >
              Campus Sync
            </button>
            <Link
              id="tour-ai-chat"
              href="/chat"
              className="hover:text-black hover:underline underline-offset-4 decoration-gray-400"
            >
              AI Chat
            </Link>
            <button
              id="tour-security"
              type="button"
              onClick={openSecurity}
              className={[
                "hover:text-black hover:underline underline-offset-4 decoration-gray-400",
                securityOpen ? "text-black underline" : "",
              ].join(" ")}
            >
              Security
            </button>
          </div>
        </div>
        <UserButton />
      </nav>

      {/* Desktop area — dock fills left, main fills rest (windows are overlaid) */}
      <div className="flex flex-row min-h-screen">
        <AppDock activeDockApp={activeDockApp} onAppClick={handleDockAppClick} />
        <main className="flex-1 min-h-screen" />
      </div>

      {/* Nodegent window overlay — draggable + resizable, centered on open */}
      {activeDockApp === "nodegent" && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 40, top: "56px", pointerEvents: "none" }}
        >
          <DraggableWindow defaultWidth={780} defaultHeight={580}>
            <div className="window-shadow bg-white rounded-lg border border-gray-300 w-full h-full flex flex-col overflow-hidden">
              <WindowTitleBar onClose={() => setActiveDockApp(null)} />
              <WindowToolbar
                calendarOpen={calendarOpen}
                onCalendarToggle={() => setCalendarOpen((prev) => !prev)}
                onBack={handleBack}
                onHome={goHome}
                onCampusSync={openCampusSync}
                onCourses={openCourses}
                onRestartTour={onRestartTour ?? (() => {})}
              />
              {calendarOpen && <CalendarPanel />}
              <div className={`flex-1 overflow-y-auto p-6 ${calendarOpen ? "" : "min-h-[300px]"}`}>
                {calendarOpen ? null : securityOpen ? (
                  <SecurityPanel onClose={() => setSecurityOpen(false)} />
                ) : campusSyncOpen ? (
                  <CampusSyncPanel onClose={() => setCampusSyncOpen(false)} />
                ) : coursesOpen ? (
                  <CoursesPanel onClose={() => setCoursesOpen(false)} />
                ) : (
                  <>
                    <ConnectCanvasBanner onConnect={openCampusSyncForCanvas} />
                    {children}
                  </>
                )}
              </div>
              <WindowStatusBar />
            </div>
          </DraggableWindow>
        </div>
      )}

      {/* Iframe window overlay — pointer-events-none so dock remains clickable */}
      {iframeApp && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 40, top: "56px", pointerEvents: "none" }}
        >
          <IframeWindow
            url={iframeApp.url!}
            label={iframeApp.label}
            onClose={() => setActiveDockApp(null)}
          />
        </div>
      )}
    </div>
  );
}
