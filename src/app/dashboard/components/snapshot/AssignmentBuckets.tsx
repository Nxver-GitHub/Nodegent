"use client";

import { useState } from "react";
import { CaretDown, CaretRight, Warning, BookBookmark } from "@phosphor-icons/react";
import { Id } from "@convex/_generated/dataModel";

interface SnapshotAssignment {
  _id: Id<"assignments">;
  title: string;
  dueAt?: number;
  isCompleted: boolean;
  courseId: Id<"courses">;
  pointsPossible?: number;
  htmlUrl?: string;
}

interface DailySnapshot {
  overdue: SnapshotAssignment[];
  dueToday: SnapshotAssignment[];
  dueThisWeek: SnapshotAssignment[];
  noDueDate: SnapshotAssignment[];
}

interface AssignmentBucketsProps {
  snapshot: DailySnapshot;
  courseMap: Map<string, { courseCode: string }>;
}

type BucketKey = "overdue" | "dueToday" | "dueThisWeek";

const BUCKET_CONFIG: Record<
  BucketKey,
  { label: string; accent: string; icon: "warning" | "book" }
> = {
  overdue: { label: "Overdue", accent: "text-[#F34D52]", icon: "warning" },
  dueToday: { label: "Due Today", accent: "text-[#EB9D2A]", icon: "warning" },
  dueThisWeek: { label: "This Week", accent: "text-[#CD8407]", icon: "book" },
};

function formatDue(dueAt: number): string {
  const diff = dueAt - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 24 * 60 * 60 * 1000) {
    return new Date(dueAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BucketSection({
  bucketKey,
  assignments,
  courseMap,
  defaultOpen,
}: {
  bucketKey: BucketKey;
  assignments: SnapshotAssignment[];
  courseMap: Map<string, { courseCode: string }>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const config = BUCKET_CONFIG[bucketKey];

  if (assignments.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left py-1"
      >
        {open ? (
          <CaretDown size={10} className="text-gray-400 flex-shrink-0" />
        ) : (
          <CaretRight size={10} className="text-gray-400 flex-shrink-0" />
        )}
        <span className={`text-[10px] font-bold uppercase tracking-widest ${config.accent}`}>
          {config.label}
        </span>
        <span className="text-[10px] text-gray-400 font-mono ml-auto">
          {assignments.length}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-1 mt-1 ml-3.5">
          {assignments.map((a) => (
            <div
              key={a._id}
              className="flex items-start gap-2 py-1 border-l-2 border-gray-100 pl-2"
            >
              <div className={`flex-shrink-0 mt-0.5 ${config.accent}`}>
                {config.icon === "warning" ? (
                  <Warning size={12} weight="bold" />
                ) : (
                  <BookBookmark size={12} weight="fill" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 leading-tight truncate">
                  {a.htmlUrl ? (
                    <a
                      href={a.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {a.title}
                    </a>
                  ) : (
                    a.title
                  )}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {courseMap.get(a.courseId) && (
                    <span className="text-[10px] text-gray-400">
                      {courseMap.get(a.courseId)!.courseCode}
                    </span>
                  )}
                  {a.dueAt !== undefined && (
                    <span className="text-[10px] font-mono text-gray-400">
                      {formatDue(a.dueAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssignmentBuckets({ snapshot, courseMap }: AssignmentBucketsProps) {
  const total =
    snapshot.overdue.length + snapshot.dueToday.length + snapshot.dueThisWeek.length;

  if (total === 0) {
    return (
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Assignments
        </h3>
        <p className="text-[12px] text-gray-400">You&apos;re all caught up!</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        Assignments
      </h3>
      <div className="flex flex-col gap-0.5">
        <BucketSection
          bucketKey="overdue"
          assignments={snapshot.overdue}
          courseMap={courseMap}
          defaultOpen
        />
        <BucketSection
          bucketKey="dueToday"
          assignments={snapshot.dueToday}
          courseMap={courseMap}
          defaultOpen
        />
        <BucketSection
          bucketKey="dueThisWeek"
          assignments={snapshot.dueThisWeek}
          courseMap={courseMap}
          defaultOpen
        />
      </div>
    </div>
  );
}
