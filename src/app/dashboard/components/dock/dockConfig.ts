export type PanelId =
  | "dashboard"
  | "ai-chat"
  | "calendar"
  | "courses"
  | "campus-sync"
  | "security"
  | "slug-schedule";

export interface DefaultApp {
  id: PanelId;
  label: string;
  phosphorIcon: string;
  color: string;
  href?: string;
  externalUrl?: string;
}

// TODO Sprint 7 (US-7.3): gate SlugSchedule on user.university === "ucsc"
export const DEFAULT_APPS: DefaultApp[] = [
  { id: "dashboard",     label: "Dashboard",    phosphorIcon: "House",             color: "#CD8407" },
  { id: "ai-chat",       label: "AI Chat",      phosphorIcon: "ChatCircle",        color: "#3B82F6", href: "/chat" },
  { id: "calendar",      label: "Calendar",     phosphorIcon: "CalendarCheck",     color: "#10B981" },
  { id: "courses",       label: "Courses",      phosphorIcon: "ChalkboardTeacher", color: "#8B5CF6" },
  { id: "campus-sync",   label: "Campus Sync",  phosphorIcon: "ArrowsClockwise",   color: "#F59E0B" },
  { id: "security",      label: "Security",     phosphorIcon: "ShieldCheck",       color: "#EF4444" },
  {
    id: "slug-schedule",
    label: "SlugSchedule",
    phosphorIcon: "Clock",
    color: "#06B6D4",
    externalUrl: "https://cabalex.github.io/slugschedule/",
  },
];

export const PHOSPHOR_ICON_OPTIONS = [
  "House", "Star", "BookOpen", "Briefcase", "Globe",
  "Bell", "Heart", "Lightning", "MusicNote", "Camera",
  "Code", "Rocket", "Timer", "Trophy", "Wallet",
  "Wrench",
] as const;

export type PhosphorIconOption = typeof PHOSPHOR_ICON_OPTIONS[number];

export const COLOR_SWATCHES = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];
