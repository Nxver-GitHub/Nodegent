"use client";

import { Id } from "@convex/_generated/dataModel";
import { Eye, EyeSlash } from "@phosphor-icons/react";

interface Course {
  _id: Id<"courses">;
  name: string;
  courseCode: string;
}

interface CourseFilterProps {
  courses: Course[];
  selectedCourseId: Id<"courses"> | null;
  hiddenCourseIds: Set<string>;
  onSelect: (courseId: Id<"courses"> | null) => void;
  onToggleHidden: (courseId: Id<"courses">) => void;
}

export function CourseFilter({
  courses,
  selectedCourseId,
  hiddenCourseIds,
  onSelect,
  onToggleHidden,
}: CourseFilterProps) {
  if (courses.length === 0) return null;

  const visibleCourses = courses.filter((course) => !hiddenCourseIds.has(course._id));
  const hiddenCourses = courses.filter((course) => hiddenCourseIds.has(course._id));

  return (
    <div className="space-y-2 border-b border-gray-200 pb-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onSelect(null)}
          className={`px-3 py-1 text-[12px] font-bold rounded-sm border transition-all ${
            selectedCourseId === null
              ? "bg-[#CD8407] text-white border-[#1D1D1D] shadow-[1px_1px_0px_0px_#1D1D1D]"
              : "bg-white text-[#4D4F46] border-gray-300 hover:bg-gray-50"
          }`}
        >
          All
        </button>
        {visibleCourses.map((course) => (
          <div
            key={course._id}
            className={`flex overflow-hidden rounded-sm border transition-all ${
              selectedCourseId === course._id
                ? "border-[#1D1D1D] shadow-[1px_1px_0px_0px_#1D1D1D]"
                : "border-gray-300"
            }`}
          >
            <button
              onClick={() => onSelect(course._id)}
              className={`px-3 py-1 text-[12px] font-bold transition-colors ${
                selectedCourseId === course._id
                  ? "bg-[#CD8407] text-white"
                  : "bg-white text-[#4D4F46] hover:bg-gray-50"
              }`}
            >
              {course.courseCode}
            </button>
            <button
              type="button"
              onClick={() => onToggleHidden(course._id)}
              title={`Hide ${course.courseCode}`}
              aria-label={`Hide ${course.courseCode}`}
              className={`flex w-7 items-center justify-center border-l text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 ${
                selectedCourseId === course._id
                  ? "border-[#A76905] bg-[#B87506] text-white hover:bg-[#A76905] hover:text-white"
                  : "border-gray-200 bg-white"
              }`}
            >
              <EyeSlash size={14} weight="bold" />
            </button>
          </div>
        ))}
      </div>

      {hiddenCourses.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Hidden
          </span>
          {hiddenCourses.map((course) => (
            <button
              key={course._id}
              type="button"
              onClick={() => onToggleHidden(course._id)}
              title={`Show ${course.courseCode}`}
              aria-label={`Show ${course.courseCode}`}
              className="flex items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-500 transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-800"
            >
              <Eye size={13} weight="bold" />
              {course.courseCode}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
