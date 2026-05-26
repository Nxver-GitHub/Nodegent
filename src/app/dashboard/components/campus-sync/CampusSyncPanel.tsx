"use client";

import { CompactCanvasSync } from "./CompactCanvasSync";
import { CompactCalendarSync } from "./CompactCalendarSync";
import { AccessToggleCard } from "../AccessToggleCard";

export function CampusSyncPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Campus Sync</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage your Canvas and Google Calendar connections.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Back
        </button>
      </div>

      {/* Compact sync controls */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 divide-y divide-gray-100">
        <CompactCanvasSync />
        <CompactCalendarSync />
      </div>

      {/* Access toggles */}
      <AccessToggleCard />
    </div>
  );
}
