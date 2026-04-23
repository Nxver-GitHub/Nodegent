"use client";

import { CalendarCheck } from "@phosphor-icons/react";

interface Event {
  _id: string;
  title: string;
  startAt: number;
  endAt?: number;
  location?: string;
  eventType: "class" | "exam" | "other";
}

interface TodayScheduleProps {
  events: Event[];
}

const EVENT_TYPE_CONFIG = {
  class: { bg: "bg-blue-50", text: "text-blue-700", label: "Class" },
  exam: { bg: "bg-red-50", text: "text-red-700", label: "Exam" },
  other: { bg: "bg-gray-50", text: "text-gray-600", label: "Event" },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TodaySchedule({ events }: TodayScheduleProps) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        Today&apos;s Schedule
      </h3>

      {events.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-[12px] text-gray-400">
          <CalendarCheck size={14} />
          <span>No events today — calendar sync coming in Sprint 3</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {events.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.eventType];
            return (
              <div
                key={event._id}
                className={`flex items-start gap-2 rounded-sm px-2 py-1.5 ${config.bg}`}
              >
                <div className="flex-shrink-0 w-16 text-[10px] font-mono text-gray-500 pt-px">
                  {formatTime(event.startAt)}
                  {event.endAt && (
                    <>
                      <br />
                      <span className="text-gray-400">{formatTime(event.endAt)}</span>
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-gray-800 truncate">
                      {event.title}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1 py-px rounded-sm ${config.text} border border-current opacity-60`}
                    >
                      {config.label}
                    </span>
                  </div>
                  {event.location && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{event.location}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
