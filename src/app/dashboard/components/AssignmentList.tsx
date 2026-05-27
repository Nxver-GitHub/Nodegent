"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { BookBookmark, CheckSquare, GraduationCap, Square } from "@phosphor-icons/react";
import { AssignmentCard } from "./AssignmentCard";
import { CourseFilter } from "./CourseFilter";
import { CourseGroupRow } from "./CourseGroupRow";
import { EmptyState } from "./EmptyState";
import { useHiddenCourses } from "../hooks/useHiddenCourses";

const SHOW_COMPLETED_KEY = "nodegent.showCompleted";
const EXPANDED_GROUPS_KEY = "nodegent.expandedCourseGroups";

export function AssignmentList() {
  const searchParams = useSearchParams();
  const courseParam = searchParams.get("course") as Id<"courses"> | null;
  const [selectedCourseId, setSelectedCourseId] = useState<Id<"courses"> | null>(courseParam);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const { hiddenCourseIdSet, toggleHidden, loaded: hiddenPrefsLoaded } = useHiddenCourses();

  useEffect(() => {
    try {
      const storedCompleted = window.localStorage.getItem(SHOW_COMPLETED_KEY);
      if (storedCompleted !== null) setShowCompleted(storedCompleted === "true");

      const storedExpanded = window.localStorage.getItem(EXPANDED_GROUPS_KEY);
      if (storedExpanded) {
        const parsed: unknown = JSON.parse(storedExpanded);
        if (Array.isArray(parsed)) {
          setExpandedGroups(
            new Set(parsed.filter((id): id is string => typeof id === "string"))
          );
        }
      }
    } catch {
      // ignore parse errors
    } finally {
      setPrefsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    window.localStorage.setItem(SHOW_COMPLETED_KEY, String(showCompleted));
  }, [showCompleted, prefsLoaded]);

  useEffect(() => {
    if (!prefsLoaded) return;
    window.localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify([...expandedGroups]));
  }, [expandedGroups, prefsLoaded]);

  const courses = useQuery(api.courses.getCourses);
  // Incomplete upcoming — used for the default grouped view
  const upcoming = useQuery(api.assignments.getUpcomingAssignments);
  // All assignments (including completed) — only fetched when "Show completed" is on and no course filter
  const allAssignments = useQuery(
    api.assignments.getAssignments,
    !selectedCourseId && showCompleted ? {} : "skip"
  );
  // Per-course: all assignments for selected course
  const byCourse = useQuery(
    api.assignments.getAssignments,
    selectedCourseId ? { courseId: selectedCourseId } : "skip"
  );

  const markComplete = useMutation(api.assignments.markComplete);

  useEffect(() => {
    if (selectedCourseId && hiddenCourseIdSet.has(selectedCourseId)) {
      setSelectedCourseId(null);
    }
  }, [hiddenCourseIdSet, selectedCourseId]);

  const handleToggleComplete = (id: Id<"assignments">, done: boolean) => {
    markComplete({ assignmentId: id, isCompleted: done });
  };

  function handleToggleHidden(courseId: Id<"courses">) {
    toggleHidden(courseId);
    if (selectedCourseId === courseId) setSelectedCourseId(null);
  }

  function toggleGroup(courseId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  const visibleCourses = (courses ?? []).filter((c) => !hiddenCourseIdSet.has(c._id));
  const courseMap = new Map((courses ?? []).map((c) => [c._id, c]));

  // Group assignments by courseId for the "all courses" view
  const groupedData = useMemo(() => {
    const base = showCompleted ? (allAssignments ?? []) : (upcoming ?? []);
    const visible = base.filter((a) => !hiddenCourseIdSet.has(a.courseId));
    const groups = new Map<string, typeof visible>();
    for (const a of visible) {
      const key = a.courseId as string;
      const bucket = groups.get(key);
      if (bucket) bucket.push(a);
      else groups.set(key, [a]);
    }
    return groups;
  }, [showCompleted, allAssignments, upcoming, hiddenCourseIdSet]);

  // Flat list for selected-course view with completed filter applied
  const flatAssignments = useMemo(() => {
    if (!selectedCourseId) return [];
    return (byCourse ?? []).filter((a) => showCompleted || !a.isCompleted);
  }, [selectedCourseId, byCourse, showCompleted]);

  const assignmentsReady = selectedCourseId
    ? byCourse !== undefined
    : showCompleted
      ? allAssignments !== undefined
      : upcoming !== undefined;

  const isLoading =
    !hiddenPrefsLoaded || !prefsLoaded || courses === undefined || !assignmentsReady;

  const totalCount = selectedCourseId
    ? flatAssignments.length
    : [...groupedData.values()].reduce((sum, arr) => sum + arr.length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-[#CD8407] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-gray-400 font-mono">Loading assignments...</span>
        </div>
      </div>
    );
  }

  const isEmpty = selectedCourseId ? flatAssignments.length === 0 : groupedData.size === 0;

  return (
    <div className="flex flex-col gap-4">
      <CourseFilter
        courses={courses}
        selectedCourseId={selectedCourseId}
        hiddenCourseIds={hiddenCourseIdSet}
        onSelect={setSelectedCourseId}
        onToggleHidden={handleToggleHidden}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide">
          {selectedCourseId
            ? `${courseMap.get(selectedCourseId)?.courseCode ?? "Course"} — All Assignments`
            : "Assignments by Course"}
        </h3>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <span className="text-[11px] text-gray-400 font-mono">{totalCount} items</span>
          )}
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-sm border transition-all ${
              showCompleted
                ? "bg-[#CD8407] text-white border-[#A76905]"
                : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
            }`}
            title={showCompleted ? "Hide completed" : "Show completed"}
          >
            {showCompleted ? (
              <CheckSquare size={12} weight="bold" />
            ) : (
              <Square size={12} />
            )}
            Completed
          </button>
        </div>
      </div>

      {isEmpty && (
        <EmptyState
          icon={
            courses.length === 0 ? <GraduationCap size={24} /> : <BookBookmark size={24} />
          }
          title={
            courses.length === 0
              ? "No courses synced yet"
              : visibleCourses.length === 0
                ? "All courses hidden"
                : "No upcoming assignments"
          }
          description={
            courses.length === 0
              ? "Connect Canvas to pull in your courses and assignments automatically."
              : visibleCourses.length === 0
                ? "Use a hidden course chip above to show it again."
                : "You're all caught up! New assignments will appear here once your Canvas is synced."
          }
          cta={
            courses.length === 0
              ? { label: "Connect Canvas", href: "/dashboard" }
              : undefined
          }
        />
      )}

      {/* Per-course flat view */}
      {selectedCourseId && flatAssignments.length > 0 && (
        <div className="flex flex-col gap-2">
          {flatAssignments.map((assignment) => (
            <AssignmentCard
              key={assignment._id}
              assignment={assignment}
              courseName={courseMap.get(assignment.courseId)?.courseCode}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      )}

      {/* Grouped collapsible view */}
      {!selectedCourseId && groupedData.size > 0 && (
        <div className="flex flex-col gap-2">
          {[...groupedData.entries()].map(([courseId, assignments]) => (
            <CourseGroupRow
              key={courseId}
              courseCode={courseMap.get(courseId as Id<"courses">)?.courseCode ?? "Unknown"}
              assignments={assignments}
              expanded={expandedGroups.has(courseId)}
              onToggleExpand={() => toggleGroup(courseId)}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
