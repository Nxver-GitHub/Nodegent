"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { buildCourseColorMap, GCAL_COLOR } from "@/lib/calendar-colors";
import { isSameDay } from "@/lib/calendar-utils";
import type { Doc } from "@convex/_generated/dataModel";

interface CalendarViewProps {
  currentMonth: Date;
  selectedDay: Date | null;
  assignments: Doc<"assignments">[];
  events: Doc<"events">[];
  courses: Doc<"courses">[];
  onMonthChange: (dir: -1 | 1) => void;
  onDaySelect: (day: Date) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView({
  currentMonth,
  selectedDay,
  assignments,
  events,
  courses,
  onMonthChange,
  onDaySelect,
}: CalendarViewProps) {
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Build course color map
  const courseColorMap = buildCourseColorMap(courses.map((c) => c._id));

  // Build a map of day-of-month → indicators
  const firstDay = new Date(year, month, 1).getDay(); // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Collect dots per day: Map<"YYYY-MM-DD", { color, key }[]>
  type DotEntry = { color: string; key: string };
  const dotsByDay = new Map<string, DotEntry[]>();

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  for (const a of assignments) {
    if (!a.dueAt) continue;
    const date = new Date(a.dueAt);
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    const k = dayKey(date);
    const existing = dotsByDay.get(k) ?? [];
    const color = courseColorMap.get(a.courseId) ?? "#CD8407";
    if (!existing.some((d) => d.color === color)) {
      existing.push({ color, key: `a-${a._id}` });
    }
    dotsByDay.set(k, existing);
  }

  for (const e of events) {
    const date = new Date(e.startAt);
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    const k = dayKey(date);
    const existing = dotsByDay.get(k) ?? [];
    existing.push({ color: GCAL_COLOR, key: `e-${e._id}` });
    dotsByDay.set(k, existing);
  }

  // Build grid cells: leading blanks + day cells
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(-1)}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500"
          aria-label="Previous month"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className="text-[13px] font-bold text-gray-800 font-mono tracking-wide">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500"
          aria-label="Next month"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-bold text-gray-400 font-mono py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-sm overflow-hidden">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={`blank-${i}`} className="bg-[#F9F9F7] min-h-[52px]" />;
          }

          const cellDate = new Date(year, month, cell.day);
          const isToday = isSameDay(cellDate, today);
          const isSelected = selectedDay ? isSameDay(cellDate, selectedDay) : false;
          const k = dayKey(cellDate);
          const dots = dotsByDay.get(k) ?? [];

          return (
            <button
              key={`day-${cell.day}`}
              onClick={() => onDaySelect(cellDate)}
              className={[
                "bg-white min-h-[52px] p-1.5 flex flex-col items-start text-left transition-colors",
                isSelected
                  ? "bg-[#FFF3DC] ring-1 ring-inset ring-[#CD8407]"
                  : "hover:bg-[#FAFAF7]",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[11px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded-full mb-1",
                  isToday
                    ? "bg-[#CD8407] text-white"
                    : isSelected
                    ? "text-[#CD8407]"
                    : "text-gray-600",
                ].join(" ")}
              >
                {cell.day}
              </span>
              {/* Colored dots — max 4 to avoid overflow */}
              {dots.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {dots.slice(0, 4).map((dot) => (
                    <span
                      key={dot.key}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dot.color }}
                    />
                  ))}
                  {dots.length > 4 && (
                    <span className="text-[9px] text-gray-400 leading-none self-end">
                      +{dots.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {(courses.length > 8 ? courses.slice(0, 7) : courses).map((course) => (
          <div key={course._id} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: courseColorMap.get(course._id) }}
            />
            <span className="text-[10px] text-gray-500 font-mono">
              {course.courseCode}
            </span>
          </div>
        ))}
        {courses.length > 8 && (
          <span className="text-[10px] text-gray-400 font-mono">
            +{courses.length - 7} more
          </span>
        )}
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: GCAL_COLOR }}
          />
          <span className="text-[10px] text-gray-500 font-mono">Google Cal</span>
        </div>
      </div>
    </div>
  );
}
