"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  ArrowsClockwise,
  CalendarCheck,
  ChatCircle,
  Clock,
  Lock,
  PlugsConnected,
  Warning,
} from "@phosphor-icons/react";

type AuditAction =
  | "canvas_sync"
  | "calendar_sync"
  | "ai_chat"
  | "access_toggle"
  | "canvas_connected"
  | "canvas_disconnected"
  | "office_hours_viewed";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function actionLabel(action: AuditAction, details?: string): string {
  switch (action) {
    case "canvas_sync": {
      if (details) {
        try {
          const d = JSON.parse(details) as { coursesSynced?: number; assignmentsSynced?: number; error?: string };
          if (d.error) return `Canvas sync failed`;
          return `Canvas synced — ${d.coursesSynced ?? 0} courses, ${d.assignmentsSynced ?? 0} assignments`;
        } catch { /* fall through */ }
      }
      return "Canvas synced";
    }
    case "calendar_sync": {
      if (details) {
        try {
          const d = JSON.parse(details) as { eventsPushed?: number; eventsPulled?: number };
          return `Calendar synced — ${d.eventsPushed ?? 0} pushed, ${d.eventsPulled ?? 0} pulled`;
        } catch { /* fall through */ }
      }
      return "Google Calendar synced";
    }
    case "ai_chat": {
      if (details) {
        try {
          const d = JSON.parse(details) as { preview?: string };
          if (d.preview) return `AI chat — "${d.preview.slice(0, 60)}${d.preview.length > 60 ? "…" : ""}"`;
        } catch { /* fall through */ }
      }
      return "AI chat session";
    }
    case "access_toggle": {
      if (details) {
        try {
          const d = JSON.parse(details) as Record<string, boolean>;
          const parts = Object.entries(d).map(([k, v]) => `${k === "canvasEnabled" ? "Canvas" : "Calendar"} ${v ? "enabled" : "disabled"}`);
          return parts.join(", ");
        } catch { /* fall through */ }
      }
      return "Access settings changed";
    }
    case "canvas_connected": return "Canvas connected";
    case "canvas_disconnected": return "Canvas disconnected";
    case "office_hours_viewed": {
      if (details) {
        try {
          const d = JSON.parse(details) as { source?: string; courseCode?: string; courseCodes?: string[]; found?: boolean };
          if (d.source === "chat") {
            const codes = d.courseCodes?.join(", ") ?? "";
            return `Office hours accessed via chat${codes ? ` — ${codes}` : ""}`;
          }
          const label = d.courseCode ? ` — ${d.courseCode}` : "";
          if (d.source === "extraction") return `Office hours ${d.found ? "extracted" : "not found"}${label}`;
          return `Office hours viewed${label}`;
        } catch { /* fall through */ }
      }
      return "Office hours viewed";
    }
    default: return action;
  }
}

function ActionIcon({ action, status }: { action: AuditAction; status: "success" | "error" }) {
  const cls = status === "error" ? "text-red-400" : "text-[#CD8407]";
  if (status === "error") return <Warning size={14} weight="bold" className="text-red-400" />;
  switch (action) {
    case "canvas_sync": return <ArrowsClockwise size={14} weight="bold" className={cls} />;
    case "calendar_sync": return <CalendarCheck size={14} weight="bold" className={cls} />;
    case "ai_chat": return <ChatCircle size={14} weight="bold" className={cls} />;
    case "access_toggle": return <Lock size={14} weight="bold" className={cls} />;
    case "canvas_connected":
    case "canvas_disconnected": return <PlugsConnected size={14} weight="bold" className={cls} />;
    case "office_hours_viewed": return <Clock size={14} weight="bold" className={cls} />;
    default: return <ArrowsClockwise size={14} weight="bold" className={cls} />;
  }
}

export function ActivityLogCard() {
  const log = useQuery(api.auditLog.getAuditLog);

  if (log === undefined) return null;

  return (
    <div className="rounded-lg border bg-white p-6 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <ArrowsClockwise size={16} weight="bold" className="text-gray-500" />
        <h3 className="font-semibold text-gray-900">Activity Log</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        A transparent record of every action Nodegent has taken on your behalf.
      </p>

      {log.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No activity yet — sync Canvas or chat to get started.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {log.map((entry) => (
            <li key={entry._id} className="flex items-start gap-3 py-2.5">
              <div className="mt-0.5 flex-shrink-0">
                <ActionIcon action={entry.action as AuditAction} status={entry.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium leading-snug ${entry.status === "error" ? "text-red-600" : "text-gray-800"}`}>
                  {actionLabel(entry.action as AuditAction, entry.details)}
                </p>
              </div>
              <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                {formatRelative(entry.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
