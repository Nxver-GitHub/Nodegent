"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { BookBookmark, GraduationCap } from "@phosphor-icons/react";
import { AssignmentCard } from "./AssignmentCard";
import { CourseFilter } from "./CourseFilter";
import { EmptyState } from "./EmptyState";

export function AssignmentList() {
  const [selectedCourseId, setSelectedCourseId] = useState<Id<"courses"> | null>(null);

  const courses = useQuery(api.courses.getCourses);
  const upcoming = useQuery(api.assignments.getUpcomingAssignments);
  const byCourse = useQuery(
    api.assignments.getAssignments,
    selectedCourseId ? { courseId: selectedCourseId } : "skip"
  );

  const markComplete = useMutation(api.assignments.markComplete);

  // Derive the active assignment list
  const assignments = selectedCourseId ? byCourse : upcoming;

  // Loading guard — useQuery returns undefined while pending
  const isLoading = courses === undefined || assignments === undefined;

  const handleToggleComplete = (id: Id<"assignments">, done: boolean) => {
    markComplete({ assignmentId: id, isCompleted: done });
  };

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
        onSelect={setSelectedCourseId}
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
              : "No upcoming assignments"
          }
          description={
            courses.length === 0
              ? "Connect Canvas to pull in your courses and assignments automatically."
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
