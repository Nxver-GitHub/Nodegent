"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { SunHorizon, X } from "@phosphor-icons/react";
import { GreetingHeader } from "./snapshot/GreetingHeader";
import { TodaySchedule } from "./snapshot/TodaySchedule";
import { AssignmentBuckets } from "./snapshot/AssignmentBuckets";
import { CourseSummaryRow } from "./snapshot/CourseSummaryRow";
import { SyncStatusBar } from "./snapshot/SyncStatusBar";

export function SnapshotWidget() {
  const [open, setOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Gate heavy reactive queries on `open` to avoid running them while the
  // panel is hidden behind a CSS transform. `currentUser` is left ungated
  // because it's also subscribed by parent components and Convex dedupes it.
  const currentUser = useQuery(api.users.getCurrentUser);
  const snapshot = useQuery(api.assignments.getDailySnapshot, open ? {} : "skip");
  const todayEvents = useQuery(api.events.getTodayEvents, open ? {} : "skip");
  const courseSummaries = useQuery(api.courses.getCourseSummaries, open ? {} : "skip");
  const canvasStatus = useQuery(api.canvas.getCanvasStatus, open ? {} : "skip");
  const syncCanvas = useAction(api.canvas.syncCanvas);

  const courseMap = new Map(
    (courseSummaries ?? []).map((c) => [c._id, { courseCode: c.courseCode }])
  );

  async function handleSync() {
    setIsSyncing(true);
    try {
      await syncCanvas({});
    } catch {
      // errors surface in canvasStatus
    } finally {
      setIsSyncing(false);
    }
  }

  const isLoading = snapshot === undefined || currentUser === undefined;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open daily snapshot"
        className="fixed top-[3.75rem] right-4 z-40 flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors text-[12px] font-bold"
      >
        <SunHorizon size={15} weight="bold" />
        Today
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sliding panel */}
      <aside
        aria-label="Daily snapshot"
        className={`fixed top-0 right-0 h-full w-[340px] z-50 bg-white border-l border-gray-200 shadow-xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <SunHorizon size={14} weight="bold" className="text-[#CD8407]" />
            <span className="text-[12px] font-bold text-gray-700 uppercase tracking-widest">
              Daily Snapshot
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Close snapshot"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#CD8407] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <GreetingHeader
                name={currentUser?.name ?? "Student"}
                streak={currentUser?.currentStreak ?? 0}
                longestStreak={currentUser?.longestStreak ?? 0}
              />

              <TodaySchedule events={todayEvents ?? []} />

              <AssignmentBuckets
                snapshot={
                  snapshot ?? { overdue: [], dueToday: [], dueThisWeek: [], noDueDate: [] }
                }
                courseMap={courseMap}
              />

              {(courseSummaries ?? []).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Courses
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    {(courseSummaries ?? []).map((course) => (
                      <CourseSummaryRow
                        key={course._id}
                        course={course}
                        onSelect={() => setOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: sync status */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100">
          <SyncStatusBar
            status={canvasStatus}
            onSync={handleSync}
            isSyncing={isSyncing}
          />
        </div>
      </aside>
    </>
  );
}
