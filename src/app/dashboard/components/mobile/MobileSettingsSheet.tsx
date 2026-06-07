"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import {
  X,
  Sun,
  Moon,
  ArrowsClockwise,
  Bell,
  BellSlash,
  Compass,
} from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { useTheme } from "@/hooks/useTheme";
import { useWallpaper } from "@/hooks/useWallpaper";
import { useAutoSyncPreference } from "@/hooks/useAutoSyncPreference";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { WallpaperPicker } from "../WallpaperPicker";

const UNIVERSITIES = [
  { value: "ucsc",       label: "UC Santa Cruz"  },
  { value: "ucberkeley", label: "UC Berkeley"    },
  { value: "ucla",       label: "UCLA"           },
  { value: "ucsd",       label: "UC San Diego"   },
  { value: "ucdavis",   label: "UC Davis"        },
  { value: "stanford",   label: "Stanford"       },
] as const;

interface MobileSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  onRestartTour?: () => void;
}

export function MobileSettingsSheet({
  open,
  onClose,
  onRestartTour,
}: MobileSettingsSheetProps) {
  const { theme, toggleTheme } = useTheme();
  const [wallpaper, setWallpaper] = useWallpaper();
  const { autoSyncEnabled, setAutoSyncEnabled } = useAutoSyncPreference();
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateUniversity = useMutation(api.users.updateUniversity);
  const [univSaved, setUnivSaved] = useState(false);

  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } =
    usePushNotifications(currentUser?.pushSubscription);
  const sendTestPush = useAction(api.pushSend.sendTestPushToSelf);
  const [testPushState, setTestPushState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[59] bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className={`fixed left-0 right-0 bottom-0 z-[60] bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out overflow-y-auto`}
        style={{
          maxHeight: "80vh",
          transform: open ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-hidden={!open}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Settings</h2>
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 py-3 text-[14px] text-gray-700 text-left"
          >
            {theme === "dark" ? (
              <Sun size={18} className="text-yellow-500 flex-shrink-0" />
            ) : (
              <Moon size={18} className="text-indigo-500 flex-shrink-0" />
            )}
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </button>

          <div className="border-t border-gray-100" />

          {/* Auto-sync */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <ArrowsClockwise size={18} weight="bold" className="text-emerald-500 flex-shrink-0" />
              <span className="text-[14px] text-gray-700">Auto-sync on login</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSyncEnabled}
              aria-label="Toggle auto-sync on login"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                autoSyncEnabled ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  autoSyncEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Push notifications */}
          {permission !== "unsupported" && (
            <>
              <div className="border-t border-gray-100" />
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {subscribed ? (
                    <Bell size={18} weight="bold" className="text-violet-500 flex-shrink-0" />
                  ) : (
                    <BellSlash size={18} weight="bold" className="text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-[14px] text-gray-700 truncate">
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
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      subscribed ? "bg-violet-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        subscribed ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                )}
              </div>
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
                  className="w-full flex items-center gap-3 py-2 text-[13px] text-violet-600 text-left disabled:opacity-50"
                >
                  <Bell size={15} className="flex-shrink-0 ml-0.5" />
                  {testPushState === "sending"
                    ? "Sending…"
                    : testPushState === "sent"
                      ? "Sent! Check your notifications ✓"
                      : testPushState === "error"
                        ? "Failed — check console"
                        : "Send test notification"}
                </button>
              )}
            </>
          )}

          <div className="border-t border-gray-100" />

          {/* Restart tour */}
          {onRestartTour && (
            <>
              <button
                onClick={() => { onRestartTour(); onClose(); }}
                className="w-full flex items-center gap-3 py-3 text-[14px] text-gray-700 text-left"
              >
                <Compass size={18} className="text-blue-500 flex-shrink-0" />
                Restart onboarding tour
              </button>
              <div className="border-t border-gray-100" />
            </>
          )}

          {/* University */}
          <div className="py-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Profile
            </p>
            <label className="text-[12px] text-gray-500 mb-1 block">University</label>
            <select
              value={currentUser?.university ?? ""}
              onChange={async (e) => {
                if (!e.target.value) return;
                await updateUniversity({ university: e.target.value });
                setUnivSaved(true);
                setTimeout(() => setUnivSaved(false), 2000);
              }}
              className="w-full text-[13px] rounded-lg border border-gray-200 px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">Select university...</option>
              {UNIVERSITIES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            {univSaved && <p className="text-[11px] text-green-600 mt-1">Saved ✓</p>}
          </div>

          <div className="border-t border-gray-100" />

          {/* Wallpaper */}
          <div className="py-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Wallpaper
            </p>
            <WallpaperPicker value={wallpaper} onChange={setWallpaper} />
          </div>
        </div>
      </div>
    </>
  );
}
