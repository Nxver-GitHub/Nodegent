"use client";

import {
  Student,
  CalendarCheck,
  ChatCircle,
  SquaresFour,
  ArrowsClockwise,
  type Icon,
} from "@phosphor-icons/react";

export type MobileTab = "dashboard" | "calendar" | "chat" | "apps" | "sync";

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const TABS: { id: MobileTab; label: string; Icon: Icon }[] = [
  { id: "dashboard", label: "Dashboard", Icon: Student },
  { id: "calendar", label: "Calendar", Icon: CalendarCheck },
  { id: "chat", label: "AI Chat", Icon: ChatCircle },
  { id: "apps", label: "Apps", Icon: SquaresFour },
  { id: "sync", label: "Sync", Icon: ArrowsClockwise },
];

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-50 flex items-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main navigation"
    >
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
            activeTab === id ? "text-[#CD8407]" : "text-gray-400"
          }`}
          aria-label={label}
          aria-current={activeTab === id ? "page" : undefined}
        >
          <Icon size={22} weight={activeTab === id ? "fill" : "regular"} />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}
