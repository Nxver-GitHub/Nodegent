"use client";

import {
  House,
  ChatCircle,
  CalendarCheck,
  ChalkboardTeacher,
  ArrowsClockwise,
  ShieldCheck,
  Clock,
  Star,
  BookOpen,
  Briefcase,
  Globe,
  Bell,
  Heart,
  Lightning,
  MusicNote,
  Camera,
  Code,
  Rocket,
  Timer,
  Trophy,
  Wallet,
  Wrench,
  Graph,
  Robot,
  IdentificationCard,
  type Icon,
} from "@phosphor-icons/react";
import type { PhosphorIconOption } from "./dockConfig";

export const ICON_MAP: Record<PhosphorIconOption | string, Icon> = {
  House,
  ChatCircle,
  CalendarCheck,
  ChalkboardTeacher,
  ArrowsClockwise,
  ShieldCheck,
  Clock,
  Star,
  BookOpen,
  Briefcase,
  Globe,
  Bell,
  Heart,
  Lightning,
  MusicNote,
  Camera,
  Code,
  Rocket,
  Timer,
  Trophy,
  Wallet,
  Wrench,
  Graph,
  Robot,
  IdentificationCard,
};

function isEmoji(str: string): boolean {
  return !(str in ICON_MAP);
}

interface DockIconProps {
  label: string;
  icon: string;
  color?: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  tooltip?: string;
  hideable?: boolean;
}

export function DockIcon({
  label,
  icon,
  color = "#6B7280",
  active,
  onClick,
  onRemove,
  removeLabel = "Remove",
  tooltip,
  hideable = true,
}: DockIconProps) {
  const PhosphorIcon = isEmoji(icon) ? null : ICON_MAP[icon] ?? null;

  return (
    <div className="flex flex-col items-center gap-1 group">
      <div className="relative">
        <button
          onClick={onClick}
          aria-label={label}
          className={[
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-150 select-none",
            active
              ? "ring-2 ring-white ring-offset-2 ring-offset-transparent opacity-100"
              : "opacity-70 hover:opacity-100",
          ].join(" ")}
          style={{ backgroundColor: color }}
        >
          {PhosphorIcon ? (
            <PhosphorIcon size={26} weight="bold" className="text-white" />
          ) : (
            <span className="text-2xl leading-none">{icon}</span>
          )}
        </button>

        {hideable && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={`${removeLabel} ${label}`}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-900 border border-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <span className="text-white text-[10px] font-bold leading-none">×</span>
          </button>
        )}

        {tooltip && (
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded bg-gray-800 px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
          </div>
        )}
      </div>

      <span className="text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-center leading-tight max-w-[60px] truncate">
        {label}
      </span>
    </div>
  );
}
