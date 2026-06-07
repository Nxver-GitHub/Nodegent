"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { X, Lock, ChalkboardTeacher, ArrowSquareOut } from "@phosphor-icons/react";
import type { Id } from "@convex/_generated/dataModel";
import { DEFAULT_APPS, type DockApp } from "../dock/dockConfig";
import { ICON_MAP } from "../dock/DockIcon";

interface CustomApp {
  _id: Id<"dockApps">;
  name: string;
  url: string;
  icon: string;
  color?: string;
}

interface MobileAppsSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenSecurity: () => void;
  onOpenCourses: () => void;
  onOpenIframe: (app: DockApp) => void;
}

function AppTile({
  label,
  phosphorIcon,
  color,
  isExternal,
  onClick,
}: {
  label: string;
  phosphorIcon: string;
  color: string;
  isExternal: boolean;
  onClick: () => void;
}) {
  const isEmoji = !(phosphorIcon in ICON_MAP);
  const PhosphorIcon = isEmoji ? null : ICON_MAP[phosphorIcon] ?? null;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 relative"
      aria-label={label}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
        style={{ backgroundColor: color }}
      >
        {PhosphorIcon ? (
          <PhosphorIcon size={26} weight="bold" className="text-white" />
        ) : (
          <span className="text-2xl leading-none">{phosphorIcon}</span>
        )}
        {isExternal && (
          <ArrowSquareOut
            size={10}
            weight="bold"
            className="absolute bottom-1 right-1 text-white/70"
          />
        )}
      </div>
      <span className="text-[11px] font-medium text-gray-700 text-center leading-tight max-w-[60px] truncate">
        {label}
      </span>
    </button>
  );
}

export function MobileAppsSheet({
  open,
  onClose,
  onOpenSecurity,
  onOpenCourses,
  onOpenIframe,
}: MobileAppsSheetProps) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const customApps = useQuery(api.dockApps.getDockApps) as CustomApp[] | undefined;

  const hiddenDefaultApps = currentUser?.hiddenDefaultApps ?? [];
  const visibleDefaults = DEFAULT_APPS.filter((a) => {
    if (a.id === "nodegent") return false;
    if (hiddenDefaultApps.includes(a.id)) return false;
    if (
      a.id === "slug-schedule" &&
      currentUser?.university &&
      currentUser.university !== "ucsc"
    )
      return false;
    return true;
  });

  function handleDefaultAppClick(app: DockApp) {
    if (app.appType === "iframe") {
      onOpenIframe(app);
    } else {
      window.open(app.url!, "_blank", "noopener,noreferrer");
    }
    onClose();
  }

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
          maxHeight: "75vh",
          transform: open ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-hidden={!open}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-900">Apps</h2>
            <button
              onClick={onClose}
              aria-label="Close apps"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          {/* App grid */}
          <div className="grid grid-cols-4 gap-x-2 gap-y-5 mb-6">
            {visibleDefaults.map((app) => (
              <AppTile
                key={app.id}
                label={app.label}
                phosphorIcon={app.phosphorIcon}
                color={app.color}
                isExternal={app.appType === "external"}
                onClick={() => handleDefaultAppClick(app)}
              />
            ))}
            {(customApps ?? []).map((app) => (
              <AppTile
                key={app._id}
                label={app.name}
                phosphorIcon={app.icon}
                color={app.color ?? "#6B7280"}
                isExternal
                onClick={() => {
                  window.open(app.url, "_blank", "noopener,noreferrer");
                  onClose();
                }}
              />
            ))}
          </div>

          {/* Tools section */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Tools
            </p>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => { onOpenSecurity(); onClose(); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Lock size={18} weight="bold" className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Security</p>
                  <p className="text-xs text-gray-400">Access revocation & activity log</p>
                </div>
              </button>
              <button
                onClick={() => { onOpenCourses(); onClose(); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6] flex items-center justify-center flex-shrink-0">
                  <ChalkboardTeacher size={18} weight="bold" className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Courses</p>
                  <p className="text-xs text-gray-400">View your enrolled courses</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Space so content clears the bottom nav */}
        <div className="h-16 flex-shrink-0" />
      </div>
    </>
  );
}
