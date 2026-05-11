"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CalendarView } from "./CalendarView";
import { DayDetail } from "./DayDetail";

export function CalendarPanel() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Month range for events query (include a 7-day buffer on both sides)
  const { startAt, endAt } = useMemo(() => {
    const start = new Date(currentMonth);
    start.setDate(start.getDate() - 7);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 7);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [currentMonth]);

  const assignments = useQuery(api.assignments.getAssignments, {}) ?? [];
  const events = useQuery(api.events.getEvents, { startAt, endAt }) ?? [];
  const courses = useQuery(api.courses.getCourses, {}) ?? [];

  function handleMonthChange(dir: -1 | 1) {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
    setSelectedDay(null);
  }

  return (
    <div className="border-b border-gray-200 bg-[#FAFAF8]">
      <div className="flex gap-0 divide-x divide-gray-200">
        {/* Left: calendar grid */}
        <div className="flex-1 p-4 min-w-0">
          <CalendarView
            currentMonth={currentMonth}
            selectedDay={selectedDay}
            assignments={assignments}
            events={events}
            courses={courses}
            onMonthChange={handleMonthChange}
            onDaySelect={setSelectedDay}
          />
        </div>

        {/* Right: day detail */}
        <div className="w-52 flex-shrink-0 p-4 bg-white">
          {selectedDay ? (
            <DayDetail
              selectedDay={selectedDay}
              assignments={assignments}
              events={events}
              courses={courses}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                Click a day to see<br />assignments &amp; events
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
