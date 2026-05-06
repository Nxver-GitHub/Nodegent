"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Lock } from "@phosphor-icons/react";

interface ToggleRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

function ToggleRow({ label, description, enabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
        onClick={() => onToggle(!enabled)}
        className={[
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent",
          "transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          enabled ? "bg-blue-600" : "bg-gray-200",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0",
            "transition duration-200 ease-in-out",
            enabled ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function AccessToggleCard() {
  const user = useQuery(api.users.getCurrentUser);
  const updateToggles = useMutation(api.users.updateAccessToggles);

  // Still loading
  if (user === undefined) return null;

  const canvasEnabled = user?.canvasEnabled !== false;
  const calendarEnabled = user?.calendarEnabled !== false;

  async function handleCanvasToggle(next: boolean) {
    await updateToggles({ canvasEnabled: next });
  }

  async function handleCalendarToggle(next: boolean) {
    await updateToggles({ calendarEnabled: next });
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={16} weight="bold" className="text-gray-500" />
        <h3 className="font-semibold text-gray-900">Data Source Access</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Control which sources the AI assistant can read. Disabling a source pauses sync and removes
        it from AI context — your data is not deleted.
      </p>
      <div className="divide-y divide-gray-100">
        <ToggleRow
          label="Canvas LMS"
          description={
            canvasEnabled
              ? "Courses and assignments shared with AI assistant"
              : "Sync paused — Canvas data excluded from AI context"
          }
          enabled={canvasEnabled}
          onToggle={handleCanvasToggle}
        />
        <ToggleRow
          label="Google Calendar"
          description={
            calendarEnabled
              ? "Calendar events shared with AI assistant"
              : "Sync paused — Calendar events excluded from AI context"
          }
          enabled={calendarEnabled}
          onToggle={handleCalendarToggle}
        />
      </div>
    </div>
  );
}
