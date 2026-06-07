"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { X } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { CalendarView } from "../calendar/CalendarView";
import { DayDetail } from "../calendar/DayDetail";
import { useHiddenCourses } from "../../hooks/useHiddenCourses";
import { useCourseColors } from "../../hooks/useCourseColors";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatSheetHeader(day: Date): string {
  return `${MONTH_NAMES[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}`;
}

export function MobileCalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { startAt, endAt } = useMemo(() => {
    const start = new Date(currentMonth);
    start.setDate(start.getDate() - 7);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 7);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [currentMonth]);

  const { hiddenCourseIdSet } = useHiddenCourses();
  const { colorOverrides } = useCourseColors();

  const allAssignments = useQuery(api.assignments.getAssignments, {}) ?? [];
  const allEvents = useQuery(api.events.getEvents, { startAt, endAt }) ?? [];
  const allCourses = useQuery(api.courses.getCourses, {}) ?? [];

  const assignments = allAssignments.filter((a) => !hiddenCourseIdSet.has(a.courseId));
  const courses = allCourses.filter((c) => !hiddenCourseIdSet.has(c._id));
  const events = allEvents.filter((e) => !e.courseId || !hiddenCourseIdSet.has(e.courseId));

  function handleMonthChange(dir: -1 | 1) {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
    setSelectedDay(null);
  }

  const sheetOpen = selectedDay !== null;

  return (
    <div className="bg-[#FAFAF8] min-h-full">
      {/* Full-width calendar grid */}
      <div className="p-4">
        <CalendarView
          currentMonth={currentMonth}
          selectedDay={selectedDay}
          assignments={assignments}
          events={events}
          courses={courses}
          colorOverrides={colorOverrides}
          onMonthChange={handleMonthChange}
          onDaySelect={setSelectedDay}
        />
      </div>

      {/* Tap prompt when no day selected */}
      {!sheetOpen && (
        <p className="text-center text-[11px] text-gray-400 font-mono pb-6">
          Tap a day to see assignments &amp; events
        </p>
      )}

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[59] bg-black/30 transition-opacity duration-300 ${
          sheetOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSelectedDay(null)}
        aria-hidden
      />

      {/* Day detail bottom sheet */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[60] bg-white rounded-t-2xl shadow-2xl overflow-y-auto transition-transform duration-300 ease-out"
        style={{
          maxHeight: "60vh",
          transform: sheetOpen ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "calc(4rem + env(safe-area-inset-bottom))",
        }}
        aria-hidden={!sheetOpen}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sticky top-0 bg-white">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 py-2 sticky top-6 bg-white border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">
            {selectedDay ? formatSheetHeader(selectedDay) : ""}
          </p>
          <button
            onClick={() => setSelectedDay(null)}
            aria-label="Close day detail"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Day detail content */}
        <div className="px-4 pt-3 pb-2">
          {selectedDay && (
            <DayDetail
              selectedDay={selectedDay}
              assignments={assignments}
              events={events}
              courses={courses}
              colorOverrides={colorOverrides}
            />
          )}
        </div>
      </div>
    </div>
  );
}
