// Pure decision helpers for the CourseNotesSection list UI.
// Kept separate from the React component so logic is unit-testable
// without a DOM/RTL setup (vitest runs in edge-runtime here).

import { MAX_NOTE_CONTENT_CHARS } from "../../../../../convex/courseNotes.shared";

export { MAX_NOTE_CONTENT_CHARS };

// Enter submits, Shift+Enter inserts a newline. Modifier keys (Cmd/Ctrl/Alt)
// also suppress submit so browser shortcuts aren't accidentally hijacked.
export function isSubmitKey(e: {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}): boolean {
  if (e.key !== "Enter") return false;
  return !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
}

export function isCancelKey(e: { key: string }): boolean {
  return e.key === "Escape";
}

// Whether a draft is safe to submit. Mirrors the server-side guards in
// addCourseNote / updateCourseNote so the UI can disable the submit
// affordance before the user even tries.
export type SubmitValidity =
  | { ok: true; trimmed: string }
  | { ok: false; reason: "empty" | "too_long" };

export function validateNoteDraft(draft: string): SubmitValidity {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_NOTE_CONTENT_CHARS) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, trimmed };
}

export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - ts);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
