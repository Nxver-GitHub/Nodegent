// Deterministic course-to-color mapping for the calendar view.
// Each course gets a stable color based on its position in the sorted list.

const COURSE_PALETTE = [
  "#CD8407", // amber
  "#3B82F6", // blue
  "#10B981", // emerald
  "#8B5CF6", // violet
  "#EF4444", // red
  "#F59E0B", // yellow
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

export const GCAL_COLOR = "#4285F4"; // Google blue for Google Calendar events

export function buildCourseColorMap(courseIds: string[]): Map<string, string> {
  const sorted = [...courseIds].sort();
  const map = new Map<string, string>();
  sorted.forEach((id, i) => {
    map.set(id, COURSE_PALETTE[i % COURSE_PALETTE.length]);
  });
  return map;
}
