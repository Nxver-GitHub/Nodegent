"use client";

import { X, Sparkle } from "@phosphor-icons/react";

interface WeeklyDigestBannerProps {
  digest: string;
  onDismiss: () => void;
}

/**
 * Returns an ISO-8601 week key like "2026-W23" for the current date.
 * Week starts on Monday per ISO 8601.
 */
export function currentIsoWeekKey(): string {
  const now = new Date();
  const thursday = new Date(now);
  thursday.setUTCHours(0, 0, 0, 0);
  thursday.setUTCDate(now.getUTCDate() + 3 - ((now.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const DIGEST_DISMISS_KEY_PREFIX = "nodegent-digest-dismissed-";

export function WeeklyDigestBanner({ digest, onDismiss }: WeeklyDigestBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900"
    >
      {/* Icon */}
      <Sparkle
        size={15}
        weight="fill"
        className="mt-0.5 shrink-0 text-amber-500"
        aria-hidden="true"
      />

      {/* Digest text */}
      <p className="flex-1 text-[12px] leading-relaxed">{digest}</p>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss weekly digest"
        className="self-start ml-1 shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-amber-100 text-amber-600 hover:text-amber-900 transition-colors"
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}
