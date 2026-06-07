"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
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
  ArrowsOut,
  ArrowsIn,
  SquaresFour,
  Clock,
  BookOpen,
  Robot,
  IdentificationCard,
  Trophy,
  Flame,
  Bell,
  BellSlash,
  type Icon,
} from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useAutoSyncPreference } from "@/hooks/useAutoSyncPreference";
import { useWallpaper, getWallpaperStyle } from "@/hooks/useWallpaper";
import { WallpaperPicker } from "./WallpaperPicker";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { SnapshotWidget } from "./SnapshotWidget";
import { ActivityLogPanel } from "./ActivityLogPanel";
import { NotificationBell } from "./NotificationBell";
import { CalendarPanel } from "./calendar/CalendarPanel";
import { SecurityPanel } from "./security/SecurityPanel";
import { CampusSyncPanel } from "./campus-sync/CampusSyncPanel";
import { ConnectorsPanel } from "./connectors/ConnectorsPanel";
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

const UNIVERSITIES = [
  { value: "ucsc",       label: "UC Santa Cruz"  },
  { value: "ucberkeley", label: "UC Berkeley"    },
  { value: "ucla",       label: "UCLA"           },
  { value: "ucsd",       label: "UC San Diego"   },
  { value: "ucdavis",   label: "UC Davis"        },
  { value: "stanford",   label: "Stanford"       },
] as const;

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (windows.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${windows.length} minimized window${windows.length > 1 ? "s" : ""}`}
        aria-expanded={open}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#4D4F46] hover:bg-black/10 transition-colors"
      >
        <SquaresFour size={18} weight="bold" />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#CD8407] text-white text-[9px] font-bold flex items-center justify-center leading-none">
          {windows.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[168px] bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-xl z-50 py-1.5 flex flex-col">
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 select-none">
            Minimized
          </p>
          {windows.map((w) => {
            const PhosphorIcon = TRAY_ICON_MAP[w.phosphorIcon] ?? null;
            return (
              <button
                key={w.id}
                onClick={() => onRestore(w.id)}
                aria-label={`Restore ${w.label}`}
                className="flex items-center gap-2.5 px-3 py-2 text-white text-[12px] font-medium hover:bg-white/10 transition-colors text-left w-full"
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
      )}
    </div>
  );
}

// ─── FullscreenButton ─────────────────────────────────────────────────────────

function FullscreenButton({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
      aria-pressed={isFullscreen}
      title={isFullscreen ? "Exit full screen (Esc)" : "Full screen (F)"}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4D4F46] hover:bg-black/10 transition-colors"
    >
      {isFullscreen ? (
        <ArrowsIn size={18} weight="bold" />
      ) : (
        <ArrowsOut size={18} weight="bold" />
      )}
    </button>
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
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  onCalendarToggle: () => void;
  onSettingsToggle: () => void;
  onSettingsClose: () => void;
  onShortcutsOpenChange: (open: boolean) => void;
  onBack: () => void;
  onHome: () => void;
  onCampusSync: () => void;
  onCourses: () => void;
  onRestartTour: () => void;
  wallpaper: string;
  onWallpaperChange: (id: string) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

interface SettingsPopoverProps {
  onRestartTour: () => void;
  onClose: () => void;
  shortcutsOpen: boolean;
  onShortcutsOpenChange: (open: boolean) => void;
  wallpaper: string;
  onWallpaperChange: (id: string) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

function SettingsPopover({
  onRestartTour,
  onClose,
  shortcutsOpen,
  onShortcutsOpenChange,
  wallpaper,
  onWallpaperChange,
  theme,
  toggleTheme,
}: SettingsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { autoSyncEnabled, setAutoSyncEnabled } = useAutoSyncPreference();
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateUniversity = useMutation(api.users.updateUniversity);
  const [univSaved, setUnivSaved] = useState(false);
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } =
    usePushNotifications(currentUser?.pushSubscription);
  const sendTestPush = useAction(api.pushSend.sendTestPushToSelf);
  const [testPushState, setTestPushState] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
      className="absolute right-0 top-full mt-2 max-h-[min(560px,calc(100vh-240px))] w-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg z-50 py-1"
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

      {permission !== "unsupported" && (
        <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 text-[13px] text-gray-700">
          <div className="flex items-center gap-2.5 min-w-0">
            {subscribed ? (
              <Bell size={15} weight="bold" className="text-violet-500 flex-shrink-0" />
            ) : (
              <BellSlash size={15} weight="bold" className="text-gray-400 flex-shrink-0" />
            )}
            <span className="truncate">
              {permission === "denied" ? "Notifications blocked" : "Deadline notifications"}
            </span>
          </div>
          {permission === "denied" ? (
            <span className="text-[11px] text-gray-400 shrink-0">Allow in browser</span>
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={subscribed}
              aria-label="Toggle deadline push notifications"
              disabled={pushLoading}
              onClick={() => (subscribed ? unsubscribe() : subscribe())}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                subscribed ? "bg-violet-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  subscribed ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          )}
        </div>
      )}

      {subscribed && (
        <button
          type="button"
          disabled={testPushState === "sending"}
          onClick={async () => {
            setTestPushState("sending");
            try {
              const result = await sendTestPush({});
              setTestPushState(result.sent ? "sent" : "error");
            } catch {
              setTestPushState("error");
            }
            setTimeout(() => setTestPushState("idle"), 3000);
          }}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] text-violet-600 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
        >
          <Bell size={13} className="flex-shrink-0" />
          {testPushState === "sending"
            ? "Sending…"
            : testPushState === "sent"
              ? "Sent! Check your notifications ✓"
              : testPushState === "error"
                ? "Failed — check console"
                : "Send test notification"}
        </button>
      )}

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
          Profile
        </p>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">University</label>
          <select
            value={currentUser?.university ?? ""}
            onChange={async (e) => {
              if (!e.target.value) return;
              await updateUniversity({ university: e.target.value });
              setUnivSaved(true);
              setTimeout(() => setUnivSaved(false), 2000);
            }}
            className="w-full text-[12px] rounded-md border border-gray-200 px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">Select university...</option>
            {UNIVERSITIES.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          {univSaved && <p className="text-[11px] text-green-600 mt-1">Saved ✓</p>}
        </div>
      </div>

      <div className="mx-4 my-1 border-t border-gray-100" />

      <div className="px-4 py-2.5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Wallpaper
        </p>
        <WallpaperPicker value={wallpaper} onChange={onWallpaperChange} />
      </div>

      <div className="mx-4 my-1 border-t border-gray-100" />

      <details
        open={shortcutsOpen}
        onToggle={(e) => onShortcutsOpenChange(e.currentTarget.open)}
        className="px-4 py-2.5 text-[12px] text-gray-600"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          <span>Keyboard Shortcuts</span>
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 normal-case tracking-normal">
            ?
          </kbd>
        </summary>
        <div className="mt-2 space-y-1.5">
          {[
            ["⌘/Ctrl K", "Open AI chat"],
            ["⌘/Ctrl ⇧ S", "Open Campus Sync"],
            ["⌘/Ctrl ,", "Toggle Settings"],
            ["⌘/Ctrl B", "Toggle App Dock"],
            ["?", "Show shortcuts"],
          ].map(([keys, action]) => (
            <div key={keys} className="flex items-center justify-between gap-3">
              <span className="text-gray-600">{action}</span>
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </details>

    </div>
  );
}

function WindowToolbar({ calendarOpen, settingsOpen, shortcutsOpen, onCalendarToggle, onSettingsToggle, onSettingsClose, onShortcutsOpenChange, onBack, onHome, onCampusSync, onCourses, onRestartTour, wallpaper, onWallpaperChange, theme, toggleTheme }: WindowToolbarProps) {
  // US-8.3: reuse the same getCurrentUser subscription already loaded elsewhere
  // in the shell — Convex dedupes, so this costs nothing on the wire.
  const currentUser = useQuery(api.users.getCurrentUser);
  const streak = currentUser?.currentStreak ?? 0;
  const longestStreak = currentUser?.longestStreak ?? 0;
  const showStreak = streak >= 1;

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
        {showStreak && (
          <span
            title={`${streak} day streak · longest ${Math.max(streak, longestStreak)}`}
            aria-label={`${streak} day assignment streak`}
            className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 leading-none h-6"
          >
            <Flame size={12} weight="fill" className="text-amber-500" />
            {streak}
          </span>
        )}
        <div className="relative">
          <Tooltip label="Settings">
            <button
              onClick={onSettingsToggle}
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
              onClose={onSettingsClose}
              shortcutsOpen={shortcutsOpen}
              onShortcutsOpenChange={onShortcutsOpenChange}
              wallpaper={wallpaper}
              onWallpaperChange={onWallpaperChange}
              theme={theme}
              toggleTheme={toggleTheme}
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
  const status = useQuery(api.canvas.getCanvasStatus);
  const user = useQuery(api.users.getCurrentUser);

  const isActive =
    status !== undefined &&
    status !== null &&
    status.isConnected &&
    !status.needsReconnect &&
    user?.canvasEnabled !== false;

  return (
    <div className="h-6 border-t border-gray-200 bg-[#EFEFEF] flex items-center px-3 text-[11px] text-gray-500 font-mono flex-shrink-0">
      <span className="flex items-center gap-1">
        <span
          className={`w-2 h-2 rounded-full inline-block ${
            isActive ? "bg-green-400" : "bg-red-400"
          }`}
        />
        {isActive ? "LMS Sync Active" : "LMS Sync Not Active"}
      </span>
    </div>
  );
}

// ─── DashboardShell ───────────────────────────────────────────────────────────

interface DashboardShellProps {
  children: ReactNode;
  onRestartTour?: () => void;
}

export function DashboardShell({ children, onRestartTour }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [campusSyncOpen, setCampusSyncOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);
  const [wallpaper, setWallpaper] = useWallpaper();
  const { isFullscreen, isSupported: fullscreenSupported, toggleFullscreen } = useFullscreen();
  const { theme, toggleTheme } = useTheme();

  // Keyboard shortcut: "F" toggles full screen. Escape is handled natively by
  // the browser. Ignore the key while typing in a field so it doesn't fire mid-input.
  useEffect(() => {
    if (!fullscreenSupported) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      toggleFullscreen();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreenSupported, toggleFullscreen]);

  // Multi-window state: ordered array where last element = topmost (focused) window
  const [openWindows, setOpenWindows] = useState<DockAppId[]>(["nodegent"]);
  const [minimizedWindows, setMinimizedWindows] = useState<DockAppId[]>([]);
  const [minimizingId, setMinimizingId] = useState<DockAppId | null>(null);
  const [maximizedWindow, setMaximizedWindow] = useState<DockAppId | null>(null);

  function focusWindow(id: DockAppId) {
    setOpenWindows((prev) => [...prev.filter((w) => w !== id), id]);
  }

  const openWindow = useCallback((id: DockAppId) => {
    setMinimizedWindows((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : prev));
    setOpenWindows((prev) => [...prev.filter((w) => w !== id), id]);
  }, []);

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
    setConnectorsOpen(false);
    setCalendarOpen(false);
    openWindow("nodegent");
  }

  const openCampusSync = useCallback(() => {
    setCampusSyncOpen(true);
    setCoursesOpen(false);
    setSecurityOpen(false);
    setConnectorsOpen(false);
    setCalendarOpen(false);
    openWindow("nodegent");
  }, [openWindow]);

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
    setConnectorsOpen(false);
    setCalendarOpen(false);
    openWindow("nodegent");
  }

  function openConnectors() {
    setConnectorsOpen(true);
    setSecurityOpen(false);
    setCampusSyncOpen(false);
    setCoursesOpen(false);
    setCalendarOpen(false);
    openWindow("nodegent");
  }

  function goHome() {
    setSecurityOpen(false);
    setCampusSyncOpen(false);
    setCoursesOpen(false);
    setConnectorsOpen(false);
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (settingsOpen && (e.key === "?" || (e.key === "/" && e.shiftKey))) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (mod && key === "k") {
        e.preventDefault();
        router.push("/chat");
        return;
      }

      if (mod && e.shiftKey && key === "s") {
        e.preventDefault();
        openCampusSync();
        return;
      }

      if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
        return;
      }

      if (mod && key === "b") {
        e.preventDefault();
        setDockVisible((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCampusSync, router, settingsOpen]);

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
          <div className="flex items-center gap-3">
            {fullscreenSupported && (
              <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
            )}
            <MinimizedTray windows={minimizedEntries} onRestore={openWindow} />
            <UserButton />
          </div>
        </nav>
      )}

      {/* Desktop area — dock fills left, main fills rest */}
      <div className="flex flex-row min-h-screen">
        <AppDock openWindows={allOpenApps} onAppClick={handleDockAppClick} visible={dockVisible} />
        <main className="flex-1 min-h-screen" />
      </div>

      {/* Desktop footer — privacy/terms/github, behind all windows */}
      <div className="fixed bottom-0 left-0 right-0 h-6 z-30 flex items-center justify-center gap-3 pointer-events-none">
        <Link href="/privacy" className="pointer-events-auto text-[10px] text-[#4D4F46]/50 hover:text-[#4D4F46] transition-colors">
          Privacy
        </Link>
        <span className="text-[10px] text-[#4D4F46]/30">·</span>
        <Link href="/tos" className="pointer-events-auto text-[10px] text-[#4D4F46]/50 hover:text-[#4D4F46] transition-colors">
          Terms
        </Link>
        <span className="text-[10px] text-[#4D4F46]/30">·</span>
        <a href="https://github.com/Nxver-GitHub/Nodegent" target="_blank" rel="noreferrer" className="pointer-events-auto text-[10px] text-[#4D4F46]/50 hover:text-[#4D4F46] transition-colors">
          GitHub
        </a>
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
                settingsOpen={settingsOpen}
                shortcutsOpen={shortcutsOpen}
                onCalendarToggle={() => setCalendarOpen((prev) => !prev)}
                onSettingsToggle={() => setSettingsOpen((prev) => !prev)}
                onSettingsClose={() => setSettingsOpen(false)}
                onShortcutsOpenChange={setShortcutsOpen}
                onBack={handleBack}
                onHome={goHome}
                onCampusSync={openCampusSync}
                onCourses={openCourses}
                onRestartTour={onRestartTour ?? (() => {})}
                wallpaper={wallpaper}
                onWallpaperChange={setWallpaper}
                theme={theme}
                toggleTheme={toggleTheme}
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
                      transformOrigin: "top right",
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

    </div>
  );
}
