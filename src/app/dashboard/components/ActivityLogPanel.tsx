"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  ArrowsClockwise,
  CalendarCheck,
  ChatCircle,
  Clock,
  Lock,
  PlugsConnected,
  Warning,
  X,
  ClockCounterClockwise,
  CaretDown,
  Trash,
} from "@phosphor-icons/react";

type AuditAction =
  | "canvas_sync"
  | "calendar_sync"
  | "ai_chat"
  | "access_toggle"
  | "canvas_connected"
  | "canvas_disconnected"
  | "office_hours_viewed";

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
  if (status === "error") return <Warning size={13} weight="bold" className="text-red-400" />;
  switch (action) {
    case "canvas_sync": return <ArrowsClockwise size={13} weight="bold" className={cls} />;
    case "calendar_sync": return <CalendarCheck size={13} weight="bold" className={cls} />;
    case "ai_chat": return <ChatCircle size={13} weight="bold" className={cls} />;
    case "access_toggle": return <Lock size={13} weight="bold" className={cls} />;
    case "canvas_connected":
    case "canvas_disconnected": return <PlugsConnected size={13} weight="bold" className={cls} />;
    case "office_hours_viewed": return <Clock size={13} weight="bold" className={cls} />;
    default: return <ArrowsClockwise size={13} weight="bold" className={cls} />;
  }
}

// Groups assignment refs by their course code prefix ("CSE-160-01 — name" -> "CSE-160-01")
function groupAssignmentsByCourse(assignments: ContextRef[]): Map<string, ContextRef[]> {
  const map = new Map<string, ContextRef[]>();
  for (const ref of assignments) {
    const sepIdx = ref.label.indexOf(" — ");
    const key = sepIdx >= 0 ? ref.label.slice(0, sepIdx) : "Other";
    const group = map.get(key) ?? [];
    group.push(ref);
    map.set(key, group);
  }
  return map;
}

function stripCoursePrefix(label: string): string {
  const sepIdx = label.indexOf(" — ");
  return sepIdx >= 0 ? label.slice(sepIdx + 3) : label;
}

function ContextSection({ refs }: { refs: ContextRef[] }) {
  const courses = refs.filter((r) => r.type === "course");
  const assignments = refs.filter((r) => r.type === "assignment");
  const events = refs.filter((r) => r.type === "event");
  const assignmentsByCoursee = groupAssignmentsByCourse(assignments);

  return (
    <div className="mt-2 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs text-gray-600 font-medium">Context used ({refs.length})</p>

      {/* Courses */}
      {courses.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-semibold text-gray-600 hover:text-gray-800 py-0.5 select-none">
            <CaretDown size={9} weight="bold" className="transition-transform group-open:rotate-0 -rotate-90" />
            Courses ({courses.length})
          </summary>
          <ul className="mt-1 ml-3 list-disc pl-3 text-[11px] text-gray-700 space-y-0.5">
            {courses.map((r) => (
              <li key={`${r.type}:${r.id}`}>{r.label}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Assignments grouped by course */}
      {assignments.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-semibold text-gray-600 hover:text-gray-800 py-0.5 select-none">
            <CaretDown size={9} weight="bold" className="transition-transform group-open:rotate-0 -rotate-90" />
            Assignments ({assignments.length})
          </summary>
          <div className="mt-1 ml-3 flex flex-col gap-1">
            {Array.from(assignmentsByCoursee.entries()).map(([courseCode, items]) => (
              <details key={courseCode} className="group/sub">
                <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-medium text-gray-500 hover:text-gray-700 py-0.5 select-none">
                  <CaretDown size={8} weight="bold" className="transition-transform group-open/sub:rotate-0 -rotate-90" />
                  {courseCode} ({items.length})
                </summary>
                <ul className="mt-0.5 ml-3 list-disc pl-3 text-[11px] text-gray-700 space-y-0.5">
                  {items.map((r) => (
                    <li key={`${r.type}:${r.id}`}>{stripCoursePrefix(r.label)}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </details>
      )}

      {/* Events */}
      {events.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-semibold text-gray-600 hover:text-gray-800 py-0.5 select-none">
            <CaretDown size={9} weight="bold" className="transition-transform group-open:rotate-0 -rotate-90" />
            Events ({events.length})
          </summary>
          <ul className="mt-1 ml-3 list-disc pl-3 text-[11px] text-gray-700 space-y-0.5">
            {events.map((r) => (
              <li key={`${r.type}:${r.id}`}>{r.label}</li>
            ))}
          </ul>
        </details>
      )}
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
      return <ContextSection refs={refs} />;
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
    case "office_hours_viewed": {
      const src = parsed.source as string | undefined;
      const courseCode = parsed.courseCode as string | undefined;
      const courseCodes = parsed.courseCodes as string[] | undefined;
      const found = parsed.found as boolean | undefined;
      if (src === "chat") {
        return (
          <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5 leading-relaxed">
            Office hours data for{" "}
            <span className="font-semibold text-gray-700">{courseCodes?.join(", ") ?? "your courses"}</span>{" "}
            was included in the AI chat context
          </div>
        );
      }
      if (src === "extraction") {
        return (
          <div className={`mt-2 text-[11px] rounded px-2.5 py-1.5 leading-relaxed border ${
            found ? "text-gray-500 bg-gray-50 border-gray-100" : "text-amber-700 bg-amber-50 border-amber-100"
          }`}>
            {found
              ? <>Office hours <span className="font-semibold text-gray-700">extracted from syllabus</span> for {courseCode}</>              : <>Office hours <span className="font-semibold">not found</span> in syllabus for {courseCode}</>}
          </div>
        );
      }
      return (
        <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
          Student viewed office hours for <span className="font-semibold text-gray-700">{courseCode ?? "a course"}</span>
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

function ClearLogButton() {
  const clearLog = useMutation(api.auditLog.clearAuditLog);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    setClearing(true);
    try {
      await clearLog({});
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500">Clear all entries?</span>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {clearing ? "Clearing…" : "Yes, clear"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[11px] text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
    >
      <Trash size={12} weight="bold" />
      Clear log
    </button>
  );
}

export function ActivityLogPanel() {
  const [open, setOpen] = useState(false);
  // Skip the query while the panel is hidden — it re-runs reactively on every
  // assignment/canvas/calendar write and burns Convex bandwidth otherwise.
  const log = useQuery(api.auditLog.getAuditLog, open ? {} : "skip");

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

        {/* Footer: clear button */}
        {log && log.length > 0 && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100">
            <ClearLogButton />
          </div>
        )}
      </aside>
    </>
  );
}
