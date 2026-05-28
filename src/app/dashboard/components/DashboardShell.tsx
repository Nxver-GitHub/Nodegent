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
  SquaresFour,
  Clock,
  BookOpen,
  Robot,
  IdentificationCard,
  Trophy,
  type Icon,
} from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useAutoSyncPreference } from "@/hooks/useAutoSyncPreference";
import { useWallpaper, getWallpaperStyle } from "@/hooks/useWallpaper";
import { WallpaperPicker } from "./WallpaperPicker";
import { useWidgetLayout, type WidgetId, type WidgetConfig } from "@/hooks/useWidgetLayout";
import { WidgetLayoutSettings } from "./WidgetLayoutSettings";
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

// Maps phosphor icon name strings (as stored in DockApp) to components for tray chips
const TRAY_ICON_MAP: Record<string, Icon> = {
  Graph,
  Clock,
  BookOpen,
  Robot,
  IdentificationCard,
  Trophy,
};

const CONNECT_CANVAS_DISMISSED_KEY = "nodegent-connect-canvas-banner-dismissed";

// ─── MinimizedTray ────────────────────────────────────────────────────────────

interface MinimizedEntry {
  id: DockAppId;
  label: string;
  phosphorIcon: string;
  color: string;
}

function MinimizedTray({
  windows,
  onRestore,
}: {
  windows: MinimizedEntry[];
  onRestore: (id: DockAppId) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (windows.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {expanded ? (
        <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-sm rounded-full px-2 py-1.5 shadow-lg">
          {windows.map((w) => {
            const PhosphorIcon = TRAY_ICON_MAP[w.phosphorIcon] ?? null;
            return (
              <button
                key={w.id}
                onClick={() => onRestore(w.id)}
                aria-label={`Restore ${w.label}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[12px] font-medium hover:bg-white/15 transition-colors"
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: w.color }}
                >
                  {PhosphorIcon && (
                    <PhosphorIcon size={11} weight="bold" className="text-white" />
                  )}
                </span>
                {w.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[12px] font-medium select-none shadow-lg">
          <SquaresFour size={14} weight="bold" />
          <span>{windows.length} minimized</span>
        </div>
      )}
    </div>
  );
}

// ─── ConnectCanvasBanner ──────────────────────────────────────────────────────

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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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

// ─── WindowTitleBar ───────────────────────────────────────────────────────────

interface WindowTitleBarProps {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  isMaximized: boolean;
}

function WindowTitleBar({ onClose, onMinimize, onMaximize, isMaximized }: WindowTitleBarProps) {
  return (
    <div className="relative h-10 border-b border-gray-300 bg-[#F6F6F6] flex items-center justify-between px-3 flex-shrink-0 select-none">
      <div className="flex items-center gap-1 text-gray-500">
        <Graph size={14} />
      </div>
      <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-bold text-gray-800">
        nodegent.app
      </span>
      <div className="flex items-center gap-3 text-gray-400 text-base">
        <button
          onClick={onMinimize}
          aria-label="Minimize"
          className="hover:text-yellow-500 transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={onMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          className="hover:text-green-500 transition-colors"
        >
          <Square size={12} />
        </button>
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

// ─── WindowToolbar ────────────────────────────────────────────────────────────

interface WindowToolbarProps {
  calendarOpen: boolean;
  onCalendarToggle: () => void;
  onBack: () => void;
  onHome: () => void;
  onCampusSync: () => void;
  onCourses: () => void;
  onRestartTour: () => void;
  wallpaper: string;
  onWallpaperChange: (id: string) => void;
  widgetLayout: WidgetConfig[];
  onSetWidgetVisible: (id: WidgetId, visible: boolean) => void;
  onMoveWidgetUp: (id: WidgetId) => void;
  onMoveWidgetDown: (id: WidgetId) => void;
}

interface SettingsPopoverProps {
  onRestartTour: () => void;
  onClose: () => void;
  wallpaper: string;
  onWallpaperChange: (id: string) => void;
  widgetLayout: WidgetConfig[];
  onSetWidgetVisible: (id: WidgetId, visible: boolean) => void;
  onMoveWidgetUp: (id: WidgetId) => void;
  onMoveWidgetDown: (id: WidgetId) => void;
}

function SettingsPopover({
  onRestartTour,
  onClose,
  wallpaper,
  onWallpaperChange,
  widgetLayout,
  onSetWidgetVisible,
  onMoveWidgetUp,
  onMoveWidgetDown,
}: SettingsPopoverProps) {
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

      <div className="mx-4 my-1 border-t border-gray-100" />

      <div className="px-4 py-2.5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Wallpaper
        </p>
        <WallpaperPicker value={wallpaper} onChange={onWallpaperChange} />
      </div>

      <div className="mx-4 my-1 border-t border-gray-100" />

      <div className="px-4 py-2.5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Widgets
        </p>
        <WidgetLayoutSettings
          layout={widgetLayout}
          onSetVisible={onSetWidgetVisible}
          onMoveUp={onMoveWidgetUp}
          onMoveDown={onMoveWidgetDown}
        />
      </div>
    </div>
  );
}

function WindowToolbar({ calendarOpen, onCalendarToggle, onBack, onHome, onCampusSync, onCourses, onRestartTour, wallpaper, onWallpaperChange, widgetLayout, onSetWidgetVisible, onMoveWidgetUp, onMoveWidgetDown }: WindowToolbarProps) {
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
              wallpaper={wallpaper}
              onWallpaperChange={onWallpaperChange}
              widgetLayout={widgetLayout}
              onSetWidgetVisible={onSetWidgetVisible}
              onMoveWidgetUp={onMoveWidgetUp}
              onMoveWidgetDown={onMoveWidgetDown}
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

// ─── WindowStatusBar ──────────────────────────────────────────────────────────

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

// ─── DashboardShell ───────────────────────────────────────────────────────────

interface DashboardShellProps {
  children: ReactNode | ((layout: WidgetConfig[]) => ReactNode);
  onRestartTour?: () => void;
}

export function DashboardShell({ children, onRestartTour }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [campusSyncOpen, setCampusSyncOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [wallpaper, setWallpaper] = useWallpaper();
  const { layout: widgetLayout, setVisible: setWidgetVisible, moveUp: moveWidgetUp, moveDown: moveWidgetDown } = useWidgetLayout();

  // Multi-window state: ordered array where last element = topmost (focused) window
  const [openWindows, setOpenWindows] = useState<DockAppId[]>(["nodegent"]);
  const [minimizedWindows, setMinimizedWindows] = useState<DockAppId[]>([]);
  const [minimizingId, setMinimizingId] = useState<DockAppId | null>(null);
  const [maximizedWindow, setMaximizedWindow] = useState<DockAppId | null>(null);

  function focusWindow(id: DockAppId) {
    setOpenWindows((prev) => [...prev.filter((w) => w !== id), id]);
  }

  function openWindow(id: DockAppId) {
    if (minimizedWindows.includes(id)) {
      setMinimizedWindows((prev) => prev.filter((m) => m !== id));
    }
    setOpenWindows((prev) => [...prev.filter((w) => w !== id), id]);
  }

  function closeWindow(id: DockAppId) {
    setOpenWindows((prev) => prev.filter((w) => w !== id));
    setMaximizedWindow((prev) => (prev === id ? null : prev));
  }

  function handleMaximize(id: DockAppId) {
    setMaximizedWindow((prev) => (prev === id ? null : id));
    focusWindow(id);
  }

  function handleMinimize(id: DockAppId) {
    setMinimizingId(id);
    setTimeout(() => {
      setOpenWindows((prev) => prev.filter((w) => w !== id));
      setMinimizedWindows((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setMaximizedWindow((prev) => (prev === id ? null : prev));
      setMinimizingId(null);
    }, 280);
  }

  const minimizedEntries: MinimizedEntry[] = minimizedWindows.map((id) => {
    const app = DEFAULT_APPS.find((a) => a.id === id);
    return {
      id,
      label: app?.label ?? id,
      phosphorIcon: app?.phosphorIcon ?? "Graph",
      color: app?.color ?? "#CD8407",
    };
  });

  function openCourses() {
    setCoursesOpen(true);
    setSecurityOpen(false);
    setCampusSyncOpen(false);
    setCalendarOpen(false);
    openWindow("nodegent");
  }

  function openCampusSync() {
    setCampusSyncOpen(true);
    setCoursesOpen(false);
    setSecurityOpen(false);
    setCalendarOpen(false);
    openWindow("nodegent");
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
    openWindow("nodegent");
  }

  function goHome() {
    setSecurityOpen(false);
    setCampusSyncOpen(false);
    setCoursesOpen(false);
    setCalendarOpen(false);
    openWindow("nodegent");
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
    openWindow(app.id);
  }

  const isDashboard = !securityOpen && !campusSyncOpen && !coursesOpen;
  // All apps that are open or minimized — used for dock active indicators
  const allOpenApps = [...new Set([...openWindows, ...minimizedWindows])];

  return (
    <div
      className="desktop-bg min-h-screen overflow-hidden"
      style={wallpaper !== "default" ? getWallpaperStyle(wallpaper) : undefined}
    >
      <SnapshotWidget />
      <ActivityLogPanel />

      {/* Top Navigation — hidden when any window is maximized */}
      {maximizedWindow === null && (
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
      )}

      {/* Desktop area — dock fills left, main fills rest */}
      <div className="flex flex-row min-h-screen">
        <AppDock openWindows={allOpenApps} onAppClick={handleDockAppClick} />
        <main className="flex-1 min-h-screen" />
      </div>

      {/* All open windows rendered in z-order; last in array = topmost */}
      {openWindows.map((id, index) => {
        const app = DEFAULT_APPS.find((a) => a.id === id);
        if (!app) return null;

        const isWindowMaximized = maximizedWindow === id;
        const isMinimizing = minimizingId === id;
        const zIndex = 40 + index;
        const topOffset = isWindowMaximized ? "0" : "56px";

        if (app.appType === "internal") {
          const windowContent = (
            <>
              <WindowTitleBar
                onClose={() => closeWindow(id)}
                onMinimize={() => handleMinimize(id)}
                onMaximize={() => handleMaximize(id)}
                isMaximized={isWindowMaximized}
              />
              <WindowToolbar
                calendarOpen={calendarOpen}
                onCalendarToggle={() => setCalendarOpen((prev) => !prev)}
                onBack={handleBack}
                onHome={goHome}
                onCampusSync={openCampusSync}
                onCourses={openCourses}
                onRestartTour={onRestartTour ?? (() => {})}
                wallpaper={wallpaper}
                onWallpaperChange={setWallpaper}
                widgetLayout={widgetLayout}
                onSetWidgetVisible={setWidgetVisible}
                onMoveWidgetUp={moveWidgetUp}
                onMoveWidgetDown={moveWidgetDown}
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
                    {typeof children === "function" ? children(widgetLayout) : children}
                  </>
                )}
              </div>
              <WindowStatusBar />
            </>
          );

          return (
            <div
              key={id}
              className="fixed inset-0"
              style={{ zIndex, top: topOffset, pointerEvents: "none" }}
              onMouseDown={() => focusWindow(id)}
            >
              {isWindowMaximized ? (
                <div
                  className="window-shadow absolute inset-0 flex flex-col bg-white overflow-hidden"
                  style={{ pointerEvents: "auto" }}
                >
                  {windowContent}
                </div>
              ) : (
                <DraggableWindow defaultWidth={780} defaultHeight={580}>
                  <div
                    className="window-shadow bg-white rounded-lg border border-gray-300 w-full h-full flex flex-col overflow-hidden"
                    style={{
                      transition: "transform 280ms ease-in, opacity 280ms ease-in",
                      transform: isMinimizing ? "scale(0.05)" : "scale(1)",
                      opacity: isMinimizing ? 0 : 1,
                      transformOrigin: "bottom center",
                    }}
                  >
                    {windowContent}
                  </div>
                </DraggableWindow>
              )}
            </div>
          );
        }

        if (app.appType === "iframe") {
          return (
            <div
              key={id}
              className="fixed inset-0"
              style={{ zIndex, top: topOffset, pointerEvents: "none" }}
            >
              <IframeWindow
                url={app.url!}
                label={app.label}
                phosphorIcon={app.phosphorIcon}
                color={app.color}
                onClose={() => closeWindow(id)}
                onMinimize={() => handleMinimize(id)}
                onMaximize={() => handleMaximize(id)}
                isMaximized={isWindowMaximized}
                isMinimizing={isMinimizing}
                onFocus={() => focusWindow(id)}
              />
            </div>
          );
        }

        return null;
      })}

      {/* Minimized windows tray */}
      <MinimizedTray windows={minimizedEntries} onRestore={openWindow} />
    </div>
  );
}
