"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { SunHorizon } from "@phosphor-icons/react";
import { AssignmentBuckets } from "./snapshot/AssignmentBuckets";
import { CourseSummaryRow } from "./snapshot/CourseSummaryRow";

export function SnapshotPanel() {
  const snapshot = useQuery(api.assignments.getDailySnapshot);
  const courseSummaries = useQuery(api.courses.getCourseSummaries);

  const courseMap = new Map(
    (courseSummaries ?? []).map((c) => [c._id, { courseCode: c.courseCode }])
  );

  const isLoading = snapshot === undefined || courseSummaries === undefined;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SunHorizon size={14} weight="bold" className="text-[#CD8407]" />
        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
          Snapshot
        </h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-[#CD8407] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <AssignmentBuckets
            snapshot={snapshot ?? { overdue: [], dueToday: [], dueThisWeek: [], noDueDate: [] }}
            courseMap={courseMap}
            onFocus={() => {}}
          />

          {(courseSummaries ?? []).length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Courses
              </h3>
              <div className="flex flex-col gap-0.5">
                {(courseSummaries ?? []).map((course) => (
                  <CourseSummaryRow key={course._id} course={course} onSelect={() => {}} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
