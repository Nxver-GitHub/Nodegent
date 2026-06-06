"use client";

import { X, Sparkle } from "@phosphor-icons/react";

interface DigestLink {
  title: string;
  course: string;
  url: string;
}

interface WeeklyDigestBannerProps {
  digest: string;
  links?: DigestLink[];
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

export function WeeklyDigestBanner({ digest, links = [], onDismiss }: WeeklyDigestBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="weekly-digest-banner"
      className="relative flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900"
    >
      {/* Header row */}
      <div className="flex gap-3">
        <Sparkle
          size={15}
          weight="fill"
          className="mt-0.5 shrink-0 text-amber-500"
          aria-hidden="true"
        />
        <p className="flex-1 text-[12px] leading-relaxed">{digest}</p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss digest"
          className="self-start ml-1 shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-amber-100 text-amber-600 hover:text-amber-900 transition-colors"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      {/* Clickable assignment links */}
      {links.length > 0 && (
        <div className="pl-6 flex flex-wrap gap-1.5">
          {links.map((link) => {
            // Only allow http/https — blocks javascript: and data: URLs
            let safeUrl: string | null = null;
            try {
              const u = new URL(link.url);
              if (u.protocol === "https:" || u.protocol === "http:") safeUrl = u.toString();
            } catch {
              // malformed URL — skip
            }
            if (!safeUrl) return null;
            return (
              <a
                key={link.url}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={link.title}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-semibold transition-colors max-w-[160px] truncate"
              >
                {link.course && (
                  <span className="text-amber-500 shrink-0">{link.course}</span>
                )}
                <span className="truncate">{link.title}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
