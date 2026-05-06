"use client";

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

export function NewAssignmentsBanner() {
  const newAssignments = useQuery(api.assignments.getNewAssignments);
  const dismissOne = useMutation(api.assignments.dismissNewAssignment);
  const dismissAll = useMutation(api.assignments.dismissAllNewAssignments);

  // Loading or no new assignments — render nothing
  if (!newAssignments || newAssignments.length === 0) return null;

  const count = newAssignments.length;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRinging size={18} weight="fill" className="text-[#CD8407] flex-shrink-0" />
          <span className="text-[13px] font-bold text-[#4D4F46]">
            {count === 1 ? "1 new assignment" : `${count} new assignments`} found
          </span>
        </div>
        <button
          onClick={() => dismissAll({})}
          className="text-[11px] font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors"
          aria-label="Dismiss all new assignment notifications"
        >
          <XCircle size={14} />
          Dismiss all
        </button>
      </div>

      {/* Assignment list */}
      <ul className="mt-3 flex flex-col gap-1.5">
        {newAssignments.map((assignment) => (
          <li
            key={assignment._id}
            className="flex items-center justify-between gap-2 rounded-sm bg-white border border-amber-100 px-3 py-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-medium text-[#4D4F46] truncate">
                {assignment.title}
              </span>
              <span className="text-[11px] font-mono text-gray-400 flex-shrink-0">
                {formatDueDate(assignment.dueAt)}
              </span>
            </div>
            <button
              onClick={() =>
                dismissOne({ assignmentId: assignment._id as Id<"assignments"> })
              }
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={`Dismiss notification for ${assignment.title}`}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
