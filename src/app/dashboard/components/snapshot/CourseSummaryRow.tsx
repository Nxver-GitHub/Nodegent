"use client";

import { useRouter } from "next/navigation";
import { Id } from "@convex/_generated/dataModel";

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

function formatNextDue(dueAt: number | undefined): string {
  if (dueAt === undefined) return "No upcoming";
  const diff = dueAt - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 24 * 60 * 60 * 1000) return "Due today";
  return new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CourseSummaryRow({ course, onSelect }: CourseSummaryRowProps) {
  const router = useRouter();

  function handleClick() {
    router.push(`/dashboard?course=${course._id}`);
    onSelect();
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors text-left group"
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
    </button>
  );
}
