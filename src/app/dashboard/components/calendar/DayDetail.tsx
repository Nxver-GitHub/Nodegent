"use client";

import { BookOpen, CalendarBlank, MapPin, ArrowSquareOut } from "@phosphor-icons/react";
import { buildCourseColorMap } from "@/lib/calendar-colors";
import { isSameDay } from "@/lib/calendar-utils";
import type { Doc } from "@convex/_generated/dataModel";

interface DayDetailProps {
  selectedDay: Date;
  assignments: Doc<"assignments">[];
  events: Doc<"events">[];
  courses: Doc<"courses">[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  const min = String(m).padStart(2, "0");
  return `${hour}:${min} ${ampm}`;
}

export function DayDetail({ selectedDay, assignments, events, courses }: DayDetailProps) {
  const courseMap = new Map(courses.map((c) => [c._id, c]));
  const courseColorMap = buildCourseColorMap(courses.map((c) => c._id));

  const dayAssignments = assignments.filter(
    (a) => a.dueAt && isSameDay(new Date(a.dueAt), selectedDay)
  );
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), selectedDay));

  const isEmpty = dayAssignments.length === 0 && dayEvents.length === 0;

  const dateLabel = `${MONTH_NAMES[selectedDay.getMonth()]} ${selectedDay.getDate()}, ${selectedDay.getFullYear()}`;

  return (
    <div className="flex flex-col h-full">
      <div className="pb-2 mb-3 border-b border-gray-200">
        <span className="text-[12px] font-bold text-gray-700 font-mono">{dateLabel}</span>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <CalendarBlank size={28} className="text-gray-300 mb-2" />
          <p className="text-[11px] text-gray-400 font-mono">Nothing scheduled</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {/* Assignments */}
          {dayAssignments.map((a) => {
            const course = courseMap.get(a.courseId);
            const color = courseColorMap.get(a.courseId) ?? "#CD8407";
            return (
              <div
                key={a._id}
                className="border border-gray-200 rounded-sm p-2 bg-white hover:bg-[#FAFAF7] transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">
                        {a.title}
                      </p>
                      {a.htmlUrl && (
                        <a
                          href={a.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-gray-400 hover:text-[#CD8407] mt-0.5"
                          aria-label="Open in Canvas"
                        >
                          <ArrowSquareOut size={11} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <BookOpen size={9} className="text-gray-400 flex-shrink-0" />
                      <span className="text-[10px] text-gray-500 font-mono">
                        {course?.courseCode ?? "Canvas"}
                      </span>
                      {a.dueAt && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            Due {formatTime(a.dueAt)}
                          </span>
                        </>
                      )}
                    </div>
                    {a.isCompleted && (
                      <span className="inline-block mt-1 text-[9px] font-mono text-green-600 bg-green-50 px-1 rounded">
                        completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Google Calendar events */}
          {dayEvents.map((e) => (
            <div
              key={e._id}
              className="border border-gray-200 rounded-sm p-2 bg-white hover:bg-[#FAFAF7] transition-colors"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 bg-[#4285F4]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">
                    {e.title}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CalendarBlank size={9} className="text-gray-400 flex-shrink-0" />
                    <span className="text-[10px] text-gray-500 font-mono">
                      {formatTime(e.startAt)}
                      {e.endAt ? ` – ${formatTime(e.endAt)}` : ""}
                    </span>
                  </div>
                  {e.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={9} className="text-gray-400 flex-shrink-0" />
                      <span className="text-[10px] text-gray-400 font-mono truncate">
                        {e.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
