import type { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  accent: "amber" | "yellow" | "red" | "dark";
}

const ACCENT_CLASSES = {
  amber: "bg-[#CD8407] text-white",
  yellow: "bg-[#EB9D2A] text-white",
  red: "bg-[#F34D52] text-white",
  dark: "bg-[#1D1D1D] text-white",
} as const;

export function FeatureCard({ icon, title, description, accent }: FeatureCardProps) {
  return (
    <div className="brutal-border-lg flex h-full flex-col gap-4 rounded-lg bg-white p-6 text-left">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-md ${ACCENT_CLASSES[accent]}`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-extrabold tracking-tight text-gray-900">
        {title}
      </h3>
      <p className="text-[14px] leading-relaxed text-[#4D4F46]">{description}</p>
    </div>
  );
}
