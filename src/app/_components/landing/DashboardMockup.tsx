import {
  Graph,
  Student,
  ChalkboardTeacher,
  CalendarCheck,
  BellRinging,
  Gear,
  Warning,
  BookBookmark,
} from "@phosphor-icons/react/dist/ssr";

const MOCK_ASSIGNMENTS = [
  {
    badge: "Overdue",
    badgeBg: "bg-[#F34D52]",
    course: "CSE-160-01",
    title: "Lighting & Shading Lab",
    due: "Due 2 days ago",
    iconColor: "text-[#F34D52]",
    icon: "warning" as const,
  },
  {
    badge: "Due Today",
    badgeBg: "bg-[#EB9D2A]",
    course: "CSE-115A",
    title: "Sprint 4 Demo Prep",
    due: "Due 5:00 PM",
    iconColor: "text-[#EB9D2A]",
    icon: "warning" as const,
  },
  {
    badge: "This Week",
    badgeBg: "bg-[#CD8407]",
    course: "MATH-19A",
    title: "Problem Set 7",
    due: "Due Friday · 11:59 PM",
    iconColor: "text-[#CD8407]",
    icon: "book" as const,
  },
];

/**
 * Static, decorative mockup of the Nodegent OS window for the landing hero.
 * Mirrors the real DashboardShell chrome so visitors see the actual product
 * aesthetic before signing up.
 */
export function DashboardMockup() {
  return (
    <div
      className="brutal-border-lg window-shadow w-full max-w-xl overflow-hidden rounded-lg bg-white"
      aria-hidden="true"
    >
      {/* Title bar */}
      <div className="relative flex h-9 items-center justify-between border-b border-gray-300 bg-[#F6F6F6] px-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#F34D52]" />
          <span className="h-3 w-3 rounded-full bg-[#EB9D2A]" />
          <span className="h-3 w-3 rounded-full bg-[#7CC36E]" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[12px] font-bold text-gray-800">
          nodegent.app
        </span>
        <Graph size={14} className="text-gray-500" />
      </div>

      {/* Toolbar */}
      <div className="flex h-10 items-center gap-2 border-b border-gray-200 bg-white px-3">
        <div className="flex items-center gap-1.5 rounded-sm border border-gray-300 px-2 py-0.5">
          <Student size={12} weight="bold" className="text-[#CD8407]" />
          <span className="text-[11px] font-bold text-gray-800">My Dashboard</span>
        </div>
        <div className="mx-1 h-3 w-px bg-gray-200" />
        <ChalkboardTeacher size={14} weight="bold" className="text-gray-500" />
        <CalendarCheck size={14} weight="bold" className="text-gray-500" />
        <BellRinging size={14} weight="bold" className="text-gray-500" />
        <div className="ml-auto flex items-center gap-2">
          <Gear size={14} weight="bold" className="text-gray-500" />
          <span className="rounded-sm bg-[#3B82F6] px-2 py-0.5 text-[10px] font-bold text-white">
            Connect LMS
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        <div>
          <p className="text-[15px] font-extrabold text-gray-900">
            Good afternoon, Surya
          </p>
          <p className="text-[11px] text-[#6B6D63]">Wednesday · May 25</p>
        </div>

        <div className="space-y-2">
          {MOCK_ASSIGNMENTS.map((a) => (
            <div
              key={a.title}
              className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              <div className={`${a.iconColor} flex-shrink-0`}>
                {a.icon === "warning" ? (
                  <Warning size={16} weight="fill" />
                ) : (
                  <BookBookmark size={16} weight="fill" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[#6B6D63]">
                  {a.course}
                </p>
                <p className="truncate text-[12px] font-bold text-gray-900">
                  {a.title}
                </p>
              </div>
              <span
                className={`${a.badgeBg} flex-shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white`}
              >
                {a.badge}
              </span>
              <span className="hidden flex-shrink-0 text-[10px] text-[#6B6D63] sm:inline">
                {a.due}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-gray-200 bg-[#EFEFEF] px-3 font-mono text-[10px] text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="blink inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
            LMS Sync Active
          </span>
          <span className="hidden sm:inline">Sprint: 2 In-Progress</span>
        </div>
        <span>Team: 5</span>
      </div>
    </div>
  );
}
