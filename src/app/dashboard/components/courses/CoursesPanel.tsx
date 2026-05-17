"use client";

import { useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { BookOpen, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useHiddenCourses } from "../../hooks/useHiddenCourses";
import { useCourseColors } from "../../hooks/useCourseColors";
import { buildCourseColorMap } from "@/lib/calendar-colors";

function formatDue(ts: number): string {
  const diffDays = Math.ceil((ts - Date.now()) / 86_400_000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function ColorBar({
  color,
  isCustom,
  onPick,
  onReset,
}: {
  color: string;
  isCustom: boolean;
  onPick: (color: string) => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative h-2 w-full group" title="Click to customize color">
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ backgroundColor: color }}
        onClick={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="color"
        value={color}
        className="sr-only"
        onChange={(e) => onPick(e.target.value)}
      />
      {isCustom && (
        <button
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          title="Reset to default color"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <ArrowCounterClockwise size={8} weight="bold" className="text-gray-600" />
        </button>
      )}
    </div>
  );
}

export function CoursesPanel({ onClose }: { onClose: () => void }) {
  const { hiddenCourseIdSet } = useHiddenCourses();
  const { colorOverrides, setColor, resetColor } = useCourseColors();
  const allSummaries = useQuery(api.courses.getCourseSummaries);
  const summaries = allSummaries?.filter((s) => !hiddenCourseIdSet.has(s._id));

  const allIds = (allSummaries ?? []).map((s) => s._id);
  const defaultColorMap = buildCourseColorMap(allIds);

  function effectiveColor(courseId: string): string {
    return colorOverrides[courseId] ?? defaultColorMap.get(courseId) ?? "#CD8407";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Courses</h2>
          <p className="mt-1 text-sm text-gray-600">
            All your enrolled Canvas courses and upcoming work at a glance.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Back to dashboard
        </button>
      </div>

      {summaries === undefined && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border bg-white h-32 animate-pulse" />
          ))}
        </div>
      )}

      {summaries !== undefined && summaries.length === 0 && (
        <div className="rounded-lg border bg-white p-10 text-center">
          <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
          {allSummaries?.length === 0 ? (
            <>
              <p className="text-sm font-medium text-gray-700">No courses synced yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Connect Canvas via Campus Sync to see your courses here.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">All courses are hidden</p>
              <p className="text-xs text-gray-500 mt-1">
                Unhide courses from the Dashboard filter to see them here.
              </p>
            </>
          )}
        </div>
      )}

      {summaries !== undefined && summaries.length > 0 && (
        <>
          <p className="text-xs text-gray-400">
            Click a course&apos;s color bar to customize its calendar color.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {summaries.map((course) => {
              const color = effectiveColor(course._id);
              const isCustom = course._id in colorOverrides;
              const hasPending = course.pendingCount > 0;
              return (
                <div
                  key={course._id}
                  className="rounded-lg border bg-white overflow-hidden hover:shadow-sm transition-shadow"
                >
                  <ColorBar
                    color={color}
                    isCustom={isCustom}
                    onPick={(c) => setColor(course._id, c)}
                    onReset={() => resetColor(course._id)}
                  />
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {course.courseCode}
                      </span>
                      {hasPending && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 shrink-0">
                          {course.pendingCount} pending
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                      {course.name}
                    </h3>
                    <span
                      className={`inline-block text-[11px] font-medium rounded border px-1.5 py-0.5 ${
                        course.nextDueAt && course.nextDueAt - Date.now() < 172_800_000
                          ? "bg-red-50 border-red-200 text-red-700"
                          : hasPending
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}
                    >
                      {course.nextDueAt ? formatDue(course.nextDueAt) : "No upcoming work"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
