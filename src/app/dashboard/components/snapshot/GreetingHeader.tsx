"use client";

import { Flame } from "@phosphor-icons/react";

interface GreetingHeaderProps {
  name: string;
  streak?: number;
  longestStreak?: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function GreetingHeader({
  name,
  streak = 0,
  longestStreak = 0,
}: GreetingHeaderProps) {
  const firstName = name.split(" ")[0];
  const hasStreak = streak >= 1;
  const tooltip = hasStreak
    ? `${streak} day streak · longest ${Math.max(streak, longestStreak)}`
    : "Complete an assignment to start your streak";

  return (
    <div className="pb-3 border-b border-gray-100">
      <p className="text-[11px] font-mono text-gray-400 uppercase tracking-widest">
        {formatDate()}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold text-gray-900 leading-tight">
          {getGreeting()}, {firstName}
        </h2>
        <span
          title={tooltip}
          aria-label={tooltip}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 ${
            hasStreak
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-gray-50 text-gray-400 border border-gray-200"
          }`}
        >
          <Flame
            size={12}
            weight={hasStreak ? "fill" : "regular"}
            className={hasStreak ? "text-amber-500" : "text-gray-400"}
          />
          {hasStreak ? `${streak} day${streak === 1 ? "" : "s"}` : "Start a streak"}
        </span>
      </div>
    </div>
  );
}
