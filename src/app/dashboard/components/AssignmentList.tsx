"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { BookBookmark, GraduationCap } from "@phosphor-icons/react";
import { AssignmentCard } from "./AssignmentCard";
import { CourseFilter } from "./CourseFilter";
import { EmptyState } from "./EmptyState";

const HIDDEN_COURSES_STORAGE_KEY = "nodegent.hiddenCourseIds";

export function AssignmentList() {
  const [selectedCourseId, setSelectedCourseId] = useState<Id<"courses"> | null>(null);
  const [hiddenCourseIds, setHiddenCourseIds] = useState<string[]>([]);
  const [hiddenPrefsLoaded, setHiddenPrefsLoaded] = useState(false);

  const courses = useQuery(api.courses.getCourses);
  const upcoming = useQuery(api.assignments.getUpcomingAssignments);
  const byCourse = useQuery(
    api.assignments.getAssignments,
    selectedCourseId ? { courseId: selectedCourseId } : "skip"
  );

  const markComplete = useMutation(api.assignments.markComplete);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HIDDEN_COURSES_STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setHiddenCourseIds(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      setHiddenCourseIds([]);
    } finally {
      setHiddenPrefsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hiddenPrefsLoaded) return;
    window.localStorage.setItem(
      HIDDEN_COURSES_STORAGE_KEY,
      JSON.stringify(hiddenCourseIds)
    );
  }, [hiddenCourseIds, hiddenPrefsLoaded]);

  useEffect(() => {
    if (courses === undefined) return;
    const courseIds = new Set<string>(courses.map((course) => course._id));
    setHiddenCourseIds((current) => current.filter((courseId) => courseIds.has(courseId)));
  }, [courses]);

  const hiddenCourseIdSet = useMemo(
    () => new Set<string>(hiddenCourseIds),
    [hiddenCourseIds]
  );

  useEffect(() => {
    if (selectedCourseId && hiddenCourseIdSet.has(selectedCourseId)) {
      setSelectedCourseId(null);
    }
  }, [hiddenCourseIdSet, selectedCourseId]);

  // Derive the active assignment list
  const rawAssignments = selectedCourseId ? byCourse : upcoming;

  // Loading guard — useQuery returns undefined while pending
  const isLoading = courses === undefined || rawAssignments === undefined;

  const handleToggleComplete = (id: Id<"assignments">, done: boolean) => {
    markComplete({ assignmentId: id, isCompleted: done });
  };

  const handleToggleHidden = (courseId: Id<"courses">) => {
    setHiddenCourseIds((current) => {
      if (current.includes(courseId)) {
        return current.filter((id) => id !== courseId);
      }
      return [...current, courseId];
    });

    if (selectedCourseId === courseId) {
      setSelectedCourseId(null);
    }
  };

  const visibleCourses = (courses ?? []).filter(
    (course) => !hiddenCourseIdSet.has(course._id)
  );
  const assignments = (rawAssignments ?? []).filter(
    (assignment) => selectedCourseId || !hiddenCourseIdSet.has(assignment.courseId)
  );

  // Build a course lookup map for card labels
  const courseMap = new Map((courses ?? []).map((c) => [c._id, c]));

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

  return (
    <div className="flex flex-col gap-4">
      {/* Course filter */}
      <CourseFilter
        courses={courses}
        selectedCourseId={selectedCourseId}
        hiddenCourseIds={hiddenCourseIdSet}
        onSelect={setSelectedCourseId}
        onToggleHidden={handleToggleHidden}
      />

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide">
          {selectedCourseId
            ? `${courseMap.get(selectedCourseId)?.courseCode ?? "Course"} — All Assignments`
            : "Upcoming Assignments"}
        </h3>
        {assignments.length > 0 && (
          <span className="text-[11px] text-gray-400 font-mono">{assignments.length} items</span>
        )}
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <EmptyState
          icon={courses.length === 0 ? <GraduationCap size={24} /> : <BookBookmark size={24} />}
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

      {/* Assignment cards */}
      {assignments.length > 0 && (
        <div className="flex flex-col gap-2">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment._id}
              assignment={assignment}
              courseName={courseMap.get(assignment.courseId)?.courseCode}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
