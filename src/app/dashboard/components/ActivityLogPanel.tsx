"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  ArrowsClockwise,
  CalendarCheck,
  ChatCircle,
  Lock,
  PlugsConnected,
  Warning,
  X,
  ClockCounterClockwise,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react";

type AuditAction =
  | "canvas_sync"
  | "calendar_sync"
  | "ai_chat"
  | "access_toggle"
  | "canvas_connected"
  | "canvas_disconnected";

interface ContextRef {
  type: "course" | "assignment" | "event";
  id: string;
  label: string;
}

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
          if (d.error) return "Canvas sync failed";
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
    default: return action;
  }
}

function ActionIcon({ action, status }: { action: AuditAction; status: "success" | "error" }) {
  const cls = status === "error" ? "text-red-400" : "text-[#CD8407]";
  if (status === "error") return <Warning size={13} weight="bold" className="text-red-400" />;
  switch (action) {
    case "canvas_sync": return <ArrowsClockwise size={13} weight="bold" className={cls} />;
    case "calendar_sync": return <CalendarCheck size={13} weight="bold" className={cls} />;
    case "ai_chat": return <ChatCircle size={13} weight="bold" className={cls} />;
    case "access_toggle": return <Lock size={13} weight="bold" className={cls} />;
    case "canvas_connected":
    case "canvas_disconnected": return <PlugsConnected size={13} weight="bold" className={cls} />;
    default: return <ArrowsClockwise size={13} weight="bold" className={cls} />;
  }
}

const REF_TYPE_COLOR: Record<string, string> = {
  course: "bg-blue-50 text-blue-700 border-blue-200",
  assignment: "bg-amber-50 text-amber-700 border-amber-200",
  event: "bg-purple-50 text-purple-700 border-purple-200",
};

function ContextRefs({ refs }: { refs: ContextRef[] }) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {refs.map((ref) => (
        <span
          key={`${ref.type}-${ref.id}`}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${REF_TYPE_COLOR[ref.type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
        >
          {ref.label}
        </span>
      ))}
    </div>
  );
}

interface LogEntry {
  _id: string;
  action: string;
  status: "success" | "error";
  details?: string;
  timestamp: number;
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const contextRefs: ContextRef[] = (() => {
    if (!entry.details) return [];
    try {
      const d = JSON.parse(entry.details) as { contextRefs?: ContextRef[] };
      return Array.isArray(d.contextRefs) ? d.contextRefs : [];
    } catch {
      return [];
    }
  })();

  const hasContext = contextRefs.length > 0;

  return (
    <li className="py-2.5 border-b border-gray-50 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex-shrink-0">
          <ActionIcon action={entry.action as AuditAction} status={entry.status} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-medium leading-snug ${entry.status === "error" ? "text-red-600" : "text-gray-800"}`}>
            {actionLabel(entry.action as AuditAction, entry.details)}
          </p>
          {hasContext && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? <CaretDown size={9} weight="bold" /> : <CaretRight size={9} weight="bold" />}
              {expanded ? "Hide context" : `${contextRefs.length} context item${contextRefs.length > 1 ? "s" : ""} used`}
            </button>
          )}
          {expanded && <ContextRefs refs={contextRefs} />}
        </div>
        <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
          {formatRelative(entry.timestamp)}
        </span>
      </div>
    </li>
  );
}

export function ActivityLogPanel() {
  const [open, setOpen] = useState(false);
  const log = useQuery(api.auditLog.getAuditLog);

  return (
    <>
      {/* Floating toggle button — sits left of the "Today" button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open activity log"
        className="fixed bottom-6 right-[5.5rem] z-40 flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors text-[12px] font-bold"
      >
        <ClockCounterClockwise size={15} weight="bold" />
        Log
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sliding panel */}
      <aside
        aria-label="Activity log"
        className={`fixed top-0 right-0 h-full w-[340px] z-50 bg-white border-l border-gray-200 shadow-xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise size={14} weight="bold" className="text-[#CD8407]" />
            <span className="text-[12px] font-bold text-gray-700 uppercase tracking-widest">
              Activity Log
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Close activity log"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Description */}
        <div className="px-4 py-2.5 border-b border-gray-50 flex-shrink-0">
          <p className="text-[11px] text-gray-400">
            Every action Nodegent has taken on your behalf — transparent and auditable.
          </p>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {log === undefined ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#CD8407] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : log.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-10">
              No activity yet — sync Canvas or chat to get started.
            </p>
          ) : (
            <ul>
              {log.map((entry) => (
                <LogEntryRow key={entry._id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
