"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Graph, Gear, X } from "@phosphor-icons/react";
import { useWallpaper, getWallpaperStyle } from "@/hooks/useWallpaper";
import { ConnectCanvasBanner } from "../ConnectCanvasBanner";
import { CalendarPanel } from "../calendar/CalendarPanel";
import { CampusSyncPanel } from "../campus-sync/CampusSyncPanel";
import { SecurityPanel } from "../security/SecurityPanel";
import { CoursesPanel } from "../courses/CoursesPanel";
import { MobileBottomNav, type MobileTab } from "./MobileBottomNav";
import { MobileAppsSheet } from "./MobileAppsSheet";
import { MobileSnapshotCard } from "./MobileSnapshotCard";
import { MobileSettingsSheet } from "./MobileSettingsSheet";
import type { DockApp } from "../dock/dockConfig";

interface MobileShellProps {
  children: ReactNode;
  onRestartTour?: () => void;
}

export function MobileShell({ children, onRestartTour }: MobileShellProps) {
  const router = useRouter();
  const [wallpaper] = useWallpaper();

  // Which main content tab is active
  type ContentTab = "dashboard" | "calendar" | "sync";
  const [activeTab, setActiveTab] = useState<ContentTab>("dashboard");

  // Overlay states
  const [appsSheetOpen, setAppsSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [iframeApp, setIframeApp] = useState<DockApp | null>(null);

  function handleTabChange(tab: MobileTab) {
    if (tab === "chat") {
      router.push("/chat");
      return;
    }
    if (tab === "apps") {
      setAppsSheetOpen(true);
      return;
    }
    setActiveTab(tab as ContentTab);
    setAppsSheetOpen(false);
    setSecurityOpen(false);
    setCoursesOpen(false);
  }

  const navActiveTab: MobileTab = appsSheetOpen ? "apps" : activeTab;

  const wallpaperStyle =
    wallpaper !== "default" ? getWallpaperStyle(wallpaper) : undefined;

  return (
    <div
      className="flex flex-col min-h-screen bg-[#EEEFE9]"
      style={wallpaperStyle}
    >
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#EEEFE9] border-b border-gray-300 z-50 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-gray-900 rounded text-white">
            <Graph size={16} weight="bold" />
          </div>
          <span className="font-extrabold tracking-tight text-lg text-gray-900">Nodegent</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="w-8 h-8 flex items-center justify-center text-[#4D4F46] hover:bg-black/10 rounded-lg transition-colors"
          >
            <Gear size={20} weight="bold" />
          </button>
          <UserButton />
        </div>
      </header>

      {/* Main scrollable content — sits between top bar and bottom nav */}
      <main className="flex-1 pt-14 pb-16 overflow-y-auto">
        {activeTab === "dashboard" && (
          <div className="px-4 pt-4 pb-2 flex flex-col gap-4">
            <ConnectCanvasBanner onConnect={() => setActiveTab("sync")} />
            <MobileSnapshotCard />
            {children}
          </div>
        )}
        {activeTab === "calendar" && <CalendarPanel />}
        {activeTab === "sync" && (
          <div className="p-4">
            <CampusSyncPanel onClose={() => setActiveTab("dashboard")} />
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <MobileBottomNav activeTab={navActiveTab} onTabChange={handleTabChange} />

      {/* ── Full-screen Security slide-in ─────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[60] bg-white overflow-y-auto transition-transform duration-300 ease-out"
        style={{
          transform: securityOpen ? "translateX(0)" : "translateX(100%)",
          paddingTop: "3.5rem",
          paddingBottom: "4rem",
        }}
        aria-hidden={!securityOpen}
      >
        <div className="p-4">
          <SecurityPanel onClose={() => setSecurityOpen(false)} />
        </div>
      </div>

      {/* ── Full-screen Courses slide-in ──────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[60] bg-white overflow-y-auto transition-transform duration-300 ease-out"
        style={{
          transform: coursesOpen ? "translateX(0)" : "translateX(100%)",
          paddingTop: "3.5rem",
          paddingBottom: "4rem",
        }}
        aria-hidden={!coursesOpen}
      >
        <div className="p-4">
          <CoursesPanel onClose={() => setCoursesOpen(false)} />
        </div>
      </div>

      {/* ── Full-screen iframe takeover ───────────────────────────────────── */}
      {iframeApp && (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col">
          <div className="h-14 border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 bg-white">
            <button
              onClick={() => setIframeApp(null)}
              aria-label={`Close ${iframeApp.label}`}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600"
            >
              <X size={16} weight="bold" />
            </button>
            <span className="font-semibold text-gray-900 text-sm">{iframeApp.label}</span>
          </div>
          <iframe
            src={iframeApp.url!}
            title={iframeApp.label}
            className="flex-1 w-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* ── Sheets ──────────────────────────────────────────────────────────── */}
      <MobileAppsSheet
        open={appsSheetOpen}
        onClose={() => setAppsSheetOpen(false)}
        onOpenSecurity={() => setSecurityOpen(true)}
        onOpenCourses={() => setCoursesOpen(true)}
        onOpenIframe={(app) => setIframeApp(app)}
      />

      <MobileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRestartTour={onRestartTour}
      />
    </div>
  );
}
