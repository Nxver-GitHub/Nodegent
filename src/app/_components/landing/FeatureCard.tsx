import type { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="brutal-border flex flex-col gap-3 rounded-lg bg-white p-6 text-left">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1D1D1D] text-white">
        {icon}
      </div>
      <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
      <p className="text-[13px] leading-relaxed text-[#4D4F46]">{description}</p>
    </div>
  );
}
