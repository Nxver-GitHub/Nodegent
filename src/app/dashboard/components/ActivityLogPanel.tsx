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
          const parts = Object.entries(d).map(([k, v]) =>
            `${k === "canvasEnabled" ? "Canvas" : "Calendar"} ${v ? "enabled" : "disabled"}`
          );
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

const REF_COLOR: Record<string, string> = {
  course: "bg-blue-50 text-blue-700 border-blue-200",
  assignment: "bg-amber-50 text-amber-700 border-amber-200",
  event: "bg-purple-50 text-purple-700 border-purple-200",
};

function RefGroup({ label, refs }: { label: string; refs: ContextRef[] }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {refs.map((ref) => (
          <span
            key={`${ref.type}-${ref.id}`}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${REF_COLOR[ref.type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
          >
            {ref.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EntryDetails({ action, status, details }: { action: AuditAction; status: "success" | "error"; details?: string }) {
  let parsed: Record<string, unknown> = {};
  if (details) {
    try { parsed = JSON.parse(details) as Record<string, unknown>; } catch { /* ignore */ }
  }

  if (status === "error") {
    const err = parsed.error as string | undefined;
    return (
      <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2.5 py-1.5">
        {err ?? "An error occurred"}
      </div>
    );
  }

  switch (action) {
    case "canvas_sync": {
      const courses = (parsed.coursesSynced as number) ?? 0;
      const assignments = (parsed.assignmentsSynced as number) ?? 0;
      return (
        <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5 leading-relaxed">
          Accessed{" "}
          <span className="font-semibold text-gray-700">{courses} courses</span> and{" "}
          <span className="font-semibold text-gray-700">{assignments} assignments</span>{" "}
          from Canvas LMS
        </div>
      );
    }
    case "calendar_sync": {
      const pushed = (parsed.eventsPushed as number) ?? 0;
      const pulled = (parsed.eventsPulled as number) ?? 0;
      return (
        <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5 leading-relaxed">
          <span className="font-semibold text-gray-700">{pushed} assignment deadlines</span> written to Google Calendar —{" "}
          <span className="font-semibold text-gray-700">{pulled} events</span> read back
        </div>
      );
    }
    case "ai_chat": {
      const refs = parsed.contextRefs as ContextRef[] | undefined;
      if (!refs || refs.length === 0) {
        return (
          <div className="mt-2 text-[11px] text-gray-400 italic">
            No campus data was referenced for this response.
          </div>
        );
      }
      return (
        <div className="mt-2">
          <p className="text-xs text-gray-600 font-medium mb-1">Context used ({refs.length})</p>
          <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
            {refs.slice(0, 20).map((r) => (
              <li key={`${r.type}:${r.id}`}>{r.label}</li>
            ))}
            {refs.length > 20 && (
              <li className="text-gray-400">…and {refs.length - 20} more</li>
            )}
          </ul>
        </div>
      );
    }
    case "access_toggle": {
      const toggles = Object.entries(parsed).filter(([k]) => k !== "contextRefs");
      return (
        <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5 flex flex-col gap-0.5">
          {toggles.map(([k, v]) => (
            <div key={k}>
              <span className="font-semibold text-gray-700">
                {k === "canvasEnabled" ? "Canvas LMS" : "Google Calendar"}
              </span>{" "}
              was {v ? "enabled" : "disabled"}
            </div>
          ))}
        </div>
      );
    }
    case "canvas_connected":
      return (
        <div className="mt-2 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
          Canvas session cookies saved securely — Nodegent can now sync your courses and assignments.
        </div>
      );
    case "canvas_disconnected":
      return (
        <div className="mt-2 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
          Canvas credentials removed — Nodegent no longer has access to your Canvas account.
        </div>
      );
    default:
      return null;
  }
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

  return (
    <li
      className="py-2.5 border-b border-gray-50 last:border-b-0 cursor-pointer -mx-4 px-4 hover:bg-gray-50 rounded transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex-shrink-0">
          <ActionIcon action={entry.action as AuditAction} status={entry.status} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-medium leading-snug ${entry.status === "error" ? "text-red-600" : "text-gray-800"}`}>
            {actionLabel(entry.action as AuditAction, entry.details)}
          </p>
          {expanded && (
            <EntryDetails
              action={entry.action as AuditAction}
              status={entry.status}
              details={entry.details}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <span className="text-[10px] text-gray-400">{formatRelative(entry.timestamp)}</span>
          <CaretDown
            size={9}
            weight="bold"
            className={`text-gray-300 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>
    </li>
  );
}

export function ActivityLogPanel() {
  const [open, setOpen] = useState(false);
  const log = useQuery(api.auditLog.getAuditLog);

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open activity log"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors text-[12px] font-bold"
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
            Every action Nodegent has taken on your behalf — transparent and auditable. Click any entry to see the data accessed.
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
