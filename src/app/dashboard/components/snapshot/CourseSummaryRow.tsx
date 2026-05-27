"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { getUrgency } from "../AssignmentCard";

interface CourseSummary {
  _id: Id<"courses">;
  courseCode: string;
  name: string;
  pendingCount: number;
  nextDueAt?: number;
}

interface CourseSummaryRowProps {
  course: CourseSummary;
  onSelect: () => void;
}

function formatDueDate(dueAt: number | undefined): string {
  if (dueAt === undefined) return "No due date";
  const diff = dueAt - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 24 * 60 * 60 * 1000) return "Due today";
  return new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNextDue(dueAt: number | undefined): string {
  if (dueAt === undefined) return "No upcoming";
  const diff = dueAt - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 24 * 60 * 60 * 1000) return "Due today";
  return new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const URGENCY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  overdue: { bg: "bg-[#F34D52]", text: "text-white", label: "Overdue" },
  today: { bg: "bg-[#EB9D2A]", text: "text-white", label: "Due Today" },
  soon: { bg: "bg-[#CD8407]", text: "text-white", label: "Due Soon" },
  upcoming: { bg: "", text: "", label: "" },
};

export function CourseSummaryRow({ course, onSelect }: CourseSummaryRowProps) {
  const [open, setOpen] = useState(false);

  // Lazy-load assignments only when the row is expanded
  const assignments = useQuery(
    api.assignments.getAssignments,
    open ? { courseId: course._id } : "skip"
  );
  const markComplete = useMutation(api.assignments.markComplete);

  const incomplete = (assignments ?? []).filter((a) => !a.isCompleted);

  return (
    <div
      className={`rounded-sm border transition-colors ${
        open ? "border-gray-200 bg-white" : "border-transparent hover:border-gray-200"
      }`}
    >
      {/* Row header — click to expand/collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left group"
      >
        <div className="w-1 h-8 rounded-full bg-[#CD8407] opacity-60 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-gray-800 truncate group-hover:text-[#CD8407] transition-colors">
            {course.courseCode}
          </p>
          <p className="text-[10px] text-gray-400">{formatNextDue(course.nextDueAt)}</p>
        </div>
        <span className="flex-shrink-0 text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-sm">
          {course.pendingCount}
        </span>
        <span className="text-gray-400 flex-shrink-0">
          {open ? <CaretUp size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
        </span>
      </button>

      {/* Inline assignment dropdown */}
      {open && (
        <div className="border-t border-gray-100 pb-1">
          {assignments === undefined && (
            <div className="flex items-center justify-center py-2">
              <div className="w-3.5 h-3.5 border-2 border-[#CD8407] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {assignments !== undefined && incomplete.length === 0 && (
            <p className="text-[11px] text-gray-400 font-mono px-3 py-2">All caught up!</p>
          )}

          {incomplete.map((assignment) => {
            const urgency = getUrgency(assignment.dueAt);
            const badge = URGENCY_BADGE[urgency];
            return (
              <div
                key={assignment._id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-700 truncate">
                    {assignment.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-gray-400">
                      {formatDueDate(assignment.dueAt)}
                    </span>
                    {badge.label && (
                      <span
                        className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded-sm ${
                          badge.bg
                        } ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() =>
                    markComplete({ assignmentId: assignment._id, isCompleted: true })
                  }
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center border border-gray-300 rounded-sm bg-white hover:bg-gray-50 hover:border-gray-500 transition-colors"
                  title="Mark complete"
                  aria-label="Mark complete"
                >
                  <span className="w-2.5 h-2.5 border border-gray-400 rounded-sm inline-block" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
