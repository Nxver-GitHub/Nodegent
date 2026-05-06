"use client";

import { useEffect, useRef, useState } from "react";
import { BellRinging, X, XCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";

function formatDueDate(dueAt: number | undefined): string {
  if (dueAt === undefined) return "no due date";
  const diff = dueAt - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 24 * 60 * 60 * 1000) return "due today";
  return new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const newAssignments = useQuery(api.assignments.getNewAssignments);
  const dismissOne = useMutation(api.assignments.dismissNewAssignment);
  const dismissAll = useMutation(api.assignments.dismissAllNewAssignments);

  const count = newAssignments?.length ?? 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button with badge */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500 relative"
        aria-label={count > 0 ? `${count} new assignment notifications` : "No new notifications"}
      >
        <BellRinging size={16} weight={count > 0 ? "fill" : "bold"} className={count > 0 ? "text-[#CD8407]" : ""} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-[#F34D52] rounded-full text-[9px] font-bold text-white px-0.5">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-[13px] font-bold text-gray-800">New Assignments</span>
            {count > 0 && (
              <button
                onClick={() => {
                  dismissAll({});
                  setOpen(false);
                }}
                className="text-[11px] font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
              >
                <XCircle size={13} />
                Dismiss all
              </button>
            )}
          </div>

          {/* Body */}
          {count === 0 ? (
            <div className="px-4 py-6 text-center">
              <BellRinging size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-[12px] text-gray-400">No new assignments</p>
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {newAssignments!.map((assignment) => (
                <li key={assignment._id} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-medium text-[#4D4F46] truncate">
                      {assignment.title}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      {formatDueDate(assignment.dueAt)}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      dismissOne({ assignmentId: assignment._id as Id<"assignments"> })
                    }
                    className="flex-shrink-0 text-gray-300 hover:text-gray-600 transition-colors"
                    aria-label={`Dismiss ${assignment.title}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
