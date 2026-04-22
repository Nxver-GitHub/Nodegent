"use client";

import { Id } from "@convex/_generated/dataModel";

interface Course {
  _id: Id<"courses">;
  name: string;
  courseCode: string;
}

interface CourseFilterProps {
  courses: Course[];
  selectedCourseId: Id<"courses"> | null;
  onSelect: (courseId: Id<"courses"> | null) => void;
}

export function CourseFilter({ courses, selectedCourseId, onSelect }: CourseFilterProps) {
  if (courses.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-4 border-b border-gray-200">
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
      {courses.map((course) => (
        <button
          key={course._id}
          onClick={() => onSelect(course._id)}
          className={`px-3 py-1 text-[12px] font-bold rounded-sm border transition-all ${
            selectedCourseId === course._id
              ? "bg-[#CD8407] text-white border-[#1D1D1D] shadow-[1px_1px_0px_0px_#1D1D1D]"
              : "bg-white text-[#4D4F46] border-gray-300 hover:bg-gray-50"
          }`}
        >
          {course.courseCode}
        </button>
      ))}
    </div>
  );
}
