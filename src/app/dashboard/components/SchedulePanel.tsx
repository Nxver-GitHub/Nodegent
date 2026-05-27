"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CalendarCheck } from "@phosphor-icons/react";
import { TodaySchedule } from "./snapshot/TodaySchedule";

export function SchedulePanel() {
  const todayEvents = useQuery(api.events.getTodayEvents);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CalendarCheck size={14} weight="bold" className="text-[#3B82F6]" />
        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
          Today&apos;s Schedule
        </h2>
      </div>

      {todayEvents === undefined ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <TodaySchedule events={todayEvents} />
      )}
    </section>
  );
}
