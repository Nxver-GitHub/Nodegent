"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import { CaretDown, Warning, BookBookmark } from "@phosphor-icons/react";
import { GreetingHeader } from "../snapshot/GreetingHeader";
import { AssignmentBuckets } from "../snapshot/AssignmentBuckets";
import { TodaySchedule } from "../snapshot/TodaySchedule";
import { useHiddenCourses } from "../../hooks/useHiddenCourses";

export function MobileSnapshotCard() {
  const [expanded, setExpanded] = useState(false);
  const { user: clerkUser } = useUser();

  const currentUser = useQuery(api.users.getCurrentUser);
  const snapshot = useQuery(api.assignments.getDailySnapshot);
  const todayEvents = useQuery(api.events.getTodayEvents);
  const courseSummaries = useQuery(api.courses.getCourseSummaries);
  const { hiddenCourseIdSet } = useHiddenCourses();

  const courseMap = new Map(
    (courseSummaries ?? []).map((c) => [c._id, { courseCode: c.courseCode }])
  );

  const filteredSnapshot = {
    overdue: (snapshot?.overdue ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
    dueToday: (snapshot?.dueToday ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
    dueThisWeek: (snapshot?.dueThisWeek ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
    noDueDate: (snapshot?.noDueDate ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
  };

  const overdueCount = filteredSnapshot.overdue.length;
  const todayCount = filteredSnapshot.dueToday.length;
  const weekCount = filteredSnapshot.dueThisWeek.length;
  const dataReady = snapshot !== undefined;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left px-4 pt-4 pb-3"
        aria-expanded={expanded}
      >
        <GreetingHeader
          name={clerkUser?.firstName ?? clerkUser?.fullName ?? currentUser?.name ?? ""}
          streak={currentUser?.currentStreak ?? 0}
          longestStreak={currentUser?.longestStreak ?? 0}
        />

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
              <Warning size={10} weight="bold" />
              {overdueCount} overdue
            </span>
          )}
          {todayCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
              <Warning size={10} weight="bold" />
              {todayCount} today
            </span>
          )}
          {weekCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100">
              <BookBookmark size={10} weight="bold" />
              {weekCount} this week
            </span>
          )}
          {dataReady && overdueCount === 0 && todayCount === 0 && weekCount === 0 && (
            <span className="text-[11px] text-emerald-600 font-medium">All clear</span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-gray-400">
          <span>{expanded ? "Less" : "More detail"}</span>
          <CaretDown
            size={10}
            weight="bold"
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 flex flex-col gap-4">
          <TodaySchedule events={todayEvents ?? []} />
          <AssignmentBuckets
            snapshot={filteredSnapshot}
            courseMap={courseMap}
            onFocus={() => {}}
          />
        </div>
      )}
    </div>
  );
}
