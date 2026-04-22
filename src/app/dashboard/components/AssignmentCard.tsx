"use client";

import { BookBookmark, Warning, CheckCircle } from "@phosphor-icons/react";
import { Id } from "@convex/_generated/dataModel";

export type Urgency = "overdue" | "today" | "soon" | "upcoming";

export function getUrgency(dueAt: number | undefined): Urgency {
  if (dueAt === undefined) return "upcoming";
  const diff = dueAt - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 24 * 60 * 60 * 1000) return "today";
  if (diff < 3 * 24 * 60 * 60 * 1000) return "soon";
  return "upcoming";
}

function formatDueDate(dueAt: number | undefined): string {
  if (dueAt === undefined) return "No due date";
  const diff = dueAt - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 24 * 60 * 60 * 1000) return "Due today";
  return new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const URGENCY_CONFIG: Record<
  Urgency,
  { cardBg: string; badgeBg: string; badgeText: string; badgeLabel: string; iconColor: string }
> = {
  overdue: {
    cardBg: "bg-red-50 border-red-200",
    badgeBg: "bg-[#F34D52]",
    badgeText: "text-white",
    badgeLabel: "Overdue",
    iconColor: "text-[#F34D52]",
  },
  today: {
    cardBg: "bg-orange-50 border-orange-200",
    badgeBg: "bg-[#EB9D2A]",
    badgeText: "text-white",
    badgeLabel: "Due Today",
    iconColor: "text-[#EB9D2A]",
  },
  soon: {
    cardBg: "bg-yellow-50 border-yellow-200",
    badgeBg: "bg-[#CD8407]",
    badgeText: "text-white",
    badgeLabel: "Due Soon",
    iconColor: "text-[#CD8407]",
  },
  upcoming: {
    cardBg: "bg-gray-50 border-gray-200",
    badgeBg: "bg-gray-200",
    badgeText: "text-gray-600",
    badgeLabel: "",
    iconColor: "text-gray-400",
  },
};

interface AssignmentCardProps {
  assignment: {
    _id: Id<"assignments">;
    title: string;
    dueAt?: number;
    isCompleted: boolean;
    courseId: Id<"courses">;
    pointsPossible?: number;
    htmlUrl?: string;
  };
  courseName?: string;
  onToggleComplete: (id: Id<"assignments">, done: boolean) => void;
}

export function AssignmentCard({ assignment, courseName, onToggleComplete }: AssignmentCardProps) {
  const urgency = getUrgency(assignment.dueAt);
  const config = URGENCY_CONFIG[urgency];
  const dueDateLabel = formatDueDate(assignment.dueAt);

  return (
    <div
      className={`border rounded-sm p-3 flex items-center gap-3 ${config.cardBg} hover:opacity-90 transition-opacity`}
    >
      {/* Urgency icon */}
      <div className={`flex-shrink-0 ${config.iconColor}`}>
        {urgency === "overdue" || urgency === "today" ? (
          <Warning size={20} weight="bold" />
        ) : (
          <BookBookmark size={20} weight="fill" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-[#4D4F46] truncate">{assignment.title}</span>
          {urgency !== "upcoming" && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${config.badgeBg} ${config.badgeText}`}
            >
              {config.badgeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {courseName && (
            <span className="text-[11px] text-gray-500 font-medium">{courseName}</span>
          )}
          <span className="text-[11px] font-mono text-gray-400">{dueDateLabel}</span>
          {assignment.pointsPossible !== undefined && (
            <span className="text-[11px] text-gray-400">{assignment.pointsPossible} pts</span>
          )}
        </div>
      </div>

      {/* Complete toggle */}
      <button
        onClick={() => onToggleComplete(assignment._id, !assignment.isCompleted)}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center border border-gray-300 rounded-sm bg-white hover:bg-gray-50 hover:border-gray-500 transition-colors"
        title={assignment.isCompleted ? "Mark incomplete" : "Mark complete"}
        aria-label={assignment.isCompleted ? "Mark incomplete" : "Mark complete"}
      >
        {assignment.isCompleted ? (
          <CheckCircle size={16} weight="fill" className="text-[#CD8407]" />
        ) : (
          <span className="w-3 h-3 border border-gray-400 rounded-sm inline-block" />
        )}
      </button>
    </div>
  );
}
