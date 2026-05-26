import type { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  accent: "amber" | "blue" | "red" | "dark";
}

const ACCENT_ICON = {
  amber: "bg-[#CD8407] text-white",
  blue:  "bg-[#3B82F6] text-white",
  red:   "bg-[#F34D52] text-white",
  dark:  "bg-[#1D1D1D] text-white",
} as const;

const ACCENT_SPINE = {
  amber: "bg-[#CD8407]",
  blue:  "bg-[#3B82F6]",
  red:   "bg-[#F34D52]",
  dark:  "bg-[#1D1D1D]",
} as const;

/**
 * Feature card styled as a textbook cover — colored “binding spine” on the
 * left edge with stitch marks, plus the standard accented icon, title, and
 * description on the page.
 */
export function FeatureCard({ icon, title, description, accent }: FeatureCardProps) {
  return (
    <div className="brutal-border-lg relative flex h-full flex-col gap-4 overflow-hidden rounded-lg bg-white p-6 pl-10 text-left">
      {/* Textbook binding spine */}
      <div className={`absolute left-0 top-0 h-full w-5 ${ACCENT_SPINE[accent]}`} aria-hidden="true">
        <span className="absolute left-1/2 top-3 h-1 w-2 -translate-x-1/2 rounded-full bg-white/55" />
        <span className="absolute left-1/2 top-7 h-1 w-2 -translate-x-1/2 rounded-full bg-white/55" />
        <span className="absolute bottom-7 left-1/2 h-1 w-2 -translate-x-1/2 rounded-full bg-white/55" />
        <span className="absolute bottom-3 left-1/2 h-1 w-2 -translate-x-1/2 rounded-full bg-white/55" />
      </div>
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-md ${ACCENT_ICON[accent]}`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-extrabold tracking-tight text-gray-900">{title}</h3>
      <p className="text-[14px] leading-relaxed text-[#4D4F46]">{description}</p>
    </div>
  );
}
