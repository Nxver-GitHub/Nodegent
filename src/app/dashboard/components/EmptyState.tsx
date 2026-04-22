import type { ReactNode } from "react";
import Link from "next/link";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 bg-[#E1D7C2] border border-[#1D1D1D] rounded flex items-center justify-center mb-4 text-[#4D4F46] text-2xl">
        {icon}
      </div>
      <h3 className="text-[16px] font-bold text-[#4D4F46] mb-2">{title}</h3>
      <p className="text-[13.5px] text-gray-500 mb-6 max-w-xs leading-relaxed">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="brutal-border bg-[#CD8407] text-white px-5 py-2 rounded-sm text-[13px] font-bold hover:bg-[#B37000] transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
