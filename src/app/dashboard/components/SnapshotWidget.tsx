"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { SunHorizon, X } from "@phosphor-icons/react";
import { GreetingHeader } from "./snapshot/GreetingHeader";
import { TodaySchedule } from "./snapshot/TodaySchedule";
import { AssignmentBuckets, SnapshotAssignment } from "./snapshot/AssignmentBuckets";
import { CourseSummaryRow } from "./snapshot/CourseSummaryRow";
import { SyncStatusBar } from "./snapshot/SyncStatusBar";
import { StudyTimerOverlay } from "./snapshot/StudyTimerOverlay";
import {
  WeeklyDigestBanner,
  currentIsoWeekKey,
  DIGEST_DISMISS_KEY_PREFIX,
} from "./snapshot/WeeklyDigestBanner";
import { useHiddenCourses } from "../hooks/useHiddenCourses";

export function SnapshotWidget() {
  const [open, setOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [focusedAssignment, setFocusedAssignment] = useState<SnapshotAssignment | null>(null);
  const { hiddenCourseIds, hiddenCourseIdSet, loaded: hiddenLoaded } = useHiddenCourses();

  // Weekly digest state
  const [digest, setDigest] = useState<string | null>(null);
  const [digestLinks, setDigestLinks] = useState<{ title: string; course: string; url: string }[]>([]);
  const [digestDismissed, setDigestDismissed] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);

  // Gate heavy reactive queries on `open` to avoid running them while the
  // panel is hidden behind a CSS transform. `currentUser` is left ungated
  // because it's also subscribed by parent components and Convex dedupes it.
  const currentUser = useQuery(api.users.getCurrentUser);
  const snapshot = useQuery(api.assignments.getDailySnapshot, open ? {} : "skip");
  const todayEvents = useQuery(api.events.getTodayEvents, open ? {} : "skip");
  const courseSummaries = useQuery(api.courses.getCourseSummaries, open ? {} : "skip");
  const canvasStatus = useQuery(api.canvas.getCanvasStatus, open ? {} : "skip");
  const syncCanvas = useAction(api.canvas.syncCanvas);
  const generateWeeklyDigest = useAction(api.digest.generateWeeklyDigest);
  const markComplete = useMutation(api.assignments.markComplete);

  // Generate a fresh digest each time the panel opens (once per session open).
  useEffect(() => {
    if (!open || !hiddenLoaded) return;
    if (digest !== null) return; // already loaded this session

    const weekKey = currentIsoWeekKey();
    const dismissKey = `${DIGEST_DISMISS_KEY_PREFIX}${weekKey}`;

    // If dismissed this session and hidden courses unchanged, don't re-show
    const currentHiddenKey = [...hiddenCourseIds].sort().join(",");
    const storedHiddenKey = localStorage.getItem("nodegent.digestHiddenKey") ?? "";
    if (sessionStorage.getItem(dismissKey) === "true" && currentHiddenKey === storedHiddenKey) {
      setDigestDismissed(true);
      return;
    }

    sessionStorage.removeItem(dismissKey);
    setDigestDismissed(false);
    setDigestLoading(true);

    generateWeeklyDigest({ hiddenCourseIds, force: true })
      .then((result) => {
        if (!result) return;
        try {
          const parsed = JSON.parse(result) as { text: string; links: { title: string; course: string; url: string }[] };
          setDigest(parsed.text);
          setDigestLinks(parsed.links ?? []);
        } catch {
          // Fallback: treat as plain text (backward compat)
          setDigest(result);
        }
        localStorage.setItem("nodegent.digestHiddenKey", currentHiddenKey);
      })
      .catch(() => {
        // Fail silently — digest is non-critical
      })
      .finally(() => {
        setDigestLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUser?._id, hiddenLoaded]);

  const handleDismissDigest = useCallback(() => {
    const weekKey = currentIsoWeekKey();
    const dismissKey = `${DIGEST_DISMISS_KEY_PREFIX}${weekKey}`;
    sessionStorage.setItem(dismissKey, "true");
    setDigestDismissed(true);
    setDigest(null);
  }, []);

  const courseMap = new Map(
    (courseSummaries ?? []).map((c) => [c._id, { courseCode: c.courseCode }])
  );

  const visibleCourseSummaries = (courseSummaries ?? []).filter(
    (c) => !hiddenCourseIdSet.has(c._id)
  );

  const filteredSnapshot = {
    overdue: (snapshot?.overdue ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
    dueToday: (snapshot?.dueToday ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
    dueThisWeek: (snapshot?.dueThisWeek ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
    noDueDate: (snapshot?.noDueDate ?? []).filter((a) => !hiddenCourseIdSet.has(a.courseId)),
  };

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

      {/* Study timer overlay */}
      {focusedAssignment !== null && (
        <StudyTimerOverlay
          assignment={{
            _id: focusedAssignment._id,
            title: focusedAssignment.title,
            courseCode: courseMap.get(focusedAssignment.courseId)?.courseCode,
          }}
          onClose={() => setFocusedAssignment(null)}
          onMarkDone={async () => {
            try {
              await markComplete({
                assignmentId: focusedAssignment._id,
                isCompleted: true,
              });
            } catch {
              // ignore — assignment may already be gone
            }
            setFocusedAssignment(null);
          }}
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
              {/* Weekly digest banner */}
              {digestLoading && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                  <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-[11px] text-amber-700">Generating your weekly summary…</span>
                </div>
              )}
              {!digestLoading && digest && !digestDismissed && (
                <WeeklyDigestBanner digest={digest} links={digestLinks} onDismiss={handleDismissDigest} />
              )}

              <GreetingHeader
                name={currentUser?.name ?? "Student"}
                streak={currentUser?.currentStreak ?? 0}
                longestStreak={currentUser?.longestStreak ?? 0}
              />

              <TodaySchedule events={todayEvents ?? []} />

              <AssignmentBuckets
                snapshot={isLoading ? { overdue: [], dueToday: [], dueThisWeek: [], noDueDate: [] } : filteredSnapshot}
                courseMap={courseMap}
                onFocus={(a) => setFocusedAssignment(a)}
              />

              {visibleCourseSummaries.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Courses
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    {visibleCourseSummaries.map((course) => (
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
