import type { ReactNode } from "react";
import {
  PencilSimple,
  Notebook,
  Calculator,
  Coffee,
  Paperclip,
  BookOpenText,
  GraduationCap,
  PaperPlaneTilt,
} from "@phosphor-icons/react/dist/ssr";

interface DecorationProps {
  icon: ReactNode;
  className: string;
  rotation: number;
  size?: "sm" | "md" | "lg";
}

function Decoration({ icon, className, rotation, size = "md" }: DecorationProps) {
  const dims = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-10 w-10";
  return (
    <div
      className={`drift pointer-events-none absolute z-0 flex items-center justify-center ${dims} ${className}`}
      style={{ ['--rot' as string]: `${rotation}deg`, transform: `rotate(${rotation}deg)` } as React.CSSProperties}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
}

/**
 * Floating university-desk decorations that scatter across the landing hero.
 * Purely decorative — absolutely positioned, low-opacity icons that drift
 * gently to give Nodegent the “student desk” vibe without competing with copy.
 */
export function DeskDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Decoration
        icon={<PencilSimple size={32} weight="fill" className="text-[#CD8407]/70" />}
        className="left-[6%] top-[12%]"
        rotation={-22}
        size="md"
      />
      <Decoration
        icon={<Paperclip size={22} weight="bold" className="text-gray-500/70" />}
        className="left-[42%] top-[10%]"
        rotation={18}
        size="sm"
      />
      <Decoration
        icon={<Calculator size={28} weight="fill" className="text-[#1D1D1D]/75" />}
        className="left-[3%] bottom-[18%]"
        rotation={8}
        size="md"
      />
      <Decoration
        icon={<Notebook size={36} weight="fill" className="text-[#F34D52]/65" />}
        className="left-[10%] bottom-[6%]"
        rotation={-9}
        size="lg"
      />
      <Decoration
        icon={<Coffee size={24} weight="fill" className="text-[#8B5E3C]/80" />}
        className="right-[6%] top-[14%] hidden lg:block"
        rotation={12}
        size="sm"
      />
      <Decoration
        icon={<BookOpenText size={30} weight="fill" className="text-[#5B7A4B]/70" />}
        className="right-[3%] bottom-[10%] hidden md:block"
        rotation={-6}
        size="md"
      />
      <Decoration
        icon={<GraduationCap size={28} weight="fill" className="text-[#1D1D1D]/65" />}
        className="right-[16%] bottom-[28%] hidden lg:block"
        rotation={-14}
        size="sm"
      />
      <Decoration
        icon={<PaperPlaneTilt size={20} weight="fill" className="text-[#3B82F6]/65" />}
        className="left-[55%] bottom-[12%] hidden md:block"
        rotation={22}
        size="sm"
      />
    </div>
  );
}
