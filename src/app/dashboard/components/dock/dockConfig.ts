export type PanelId =
  | "dashboard"
  | "ai-chat"
  | "calendar"
  | "courses"
  | "campus-sync"
  | "security";

export type DockAppId = "nodegent" | "slug-schedule" | "canvas" | "sidekick" | "myucsc" | "gradescope";
export type AppType = "internal" | "iframe" | "external";

export interface DockApp {
  id: DockAppId;
  label: string;
  phosphorIcon: string;
  color: string;
  appType: AppType;
  url?: string;
  hideable: boolean;
  tooltip?: string;
}

// TODO Sprint 7 (US-7.3): gate SlugSchedule on user.university === "ucsc"
export const DEFAULT_APPS: DockApp[] = [
  {
    id: "nodegent",
    label: "Nodegent",
    phosphorIcon: "Graph",
    color: "#CD8407",
    appType: "internal",
    hideable: false,
  },
  {
    id: "slug-schedule",
    label: "SlugSchedule",
    phosphorIcon: "Clock",
    color: "#06B6D4",
    appType: "iframe",
    url: "https://cabalex.github.io/slugschedule/",
    hideable: true,
  },
  {
    id: "canvas",
    label: "Canvas",
    phosphorIcon: "BookOpen",
    color: "#E63946",
    appType: "external",
    url: "https://canvas.ucsc.edu/",
    hideable: true,
    tooltip: "Opens in new tab ↗",
  },
  {
    id: "sidekick",
    label: "Sidekick",
    phosphorIcon: "Robot",
    color: "#8B5CF6",
    appType: "iframe",
    url: "https://santacruz-sidekick.vercel.app/",
    hideable: true,
  },
  {
    id: "myucsc",
    label: "MyUCSC",
    phosphorIcon: "IdentificationCard",
    color: "#003C6C",
    appType: "external",
    url: "https://my.ucsc.edu/",
    hideable: true,
    tooltip: "Opens in new tab ↗",
  },
  {
    id: "gradescope",
    label: "Gradescope",
    phosphorIcon: "Trophy",
    color: "#059669",
    appType: "external",
    url: "https://www.gradescope.com/",
    hideable: true,
    tooltip: "Opens in new tab ↗",
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
