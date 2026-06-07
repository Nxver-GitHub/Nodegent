"use client";

import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Id } from "@convex/_generated/dataModel";
import { AssignmentCard } from "./AssignmentCard";

interface Assignment {
  _id: Id<"assignments">;
  title: string;
  dueAt?: number;
  isCompleted: boolean;
  courseId: Id<"courses">;
  pointsPossible?: number;
  htmlUrl?: string;
  submissionType?: string;
  submissionStatus?: string;
  score?: number;
  letterGrade?: string;
  hasDescription?: boolean;
}

interface CourseGroupRowProps {
  courseCode: string;
  assignments: Assignment[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleComplete: (id: Id<"assignments">, done: boolean) => void;
}

function getNextDue(assignments: Assignment[]): { label: string; overdue: boolean } {
  const incomplete = assignments.filter((a) => !a.isCompleted && a.dueAt !== undefined);
  if (incomplete.length === 0) return { label: "", overdue: false };
  const earliest = Math.min(...incomplete.map((a) => a.dueAt!));
  const diff = earliest - Date.now();
  if (diff < 0) return { label: "Overdue", overdue: true };
  if (diff < 24 * 60 * 60 * 1000) return { label: "Due today", overdue: false };
  return {
    label: new Date(earliest).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overdue: false,
  };
}

export function CourseGroupRow({
  courseCode,
  assignments,
  expanded,
  onToggleExpand,
  onToggleComplete,
}: CourseGroupRowProps) {
  const pending = assignments.filter((a) => !a.isCompleted).length;
  const { label: nextDueLabel, overdue } = getNextDue(assignments);

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? (
            <CaretDown size={12} weight="bold" />
          ) : (
            <CaretRight size={12} weight="bold" />
          )}
        </span>
        <span className="text-[12px] font-bold text-gray-700 flex-1 min-w-0 truncate">
          {courseCode}
        </span>
        {nextDueLabel && (
          <span
            className={`text-[10px] font-mono ${
              overdue ? "text-[#F34D52]" : "text-gray-400"
            }`}
          >
            {nextDueLabel}
          </span>
        )}
        <span
          className={`flex-shrink-0 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${
            overdue ? "bg-red-100 text-[#F34D52]" : "bg-gray-100 text-gray-500"
          }`}
        >
          {pending}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 p-2 bg-white border-t border-gray-100">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment._id}
              assignment={assignment}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
