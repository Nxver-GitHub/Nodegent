"use client";

import { ArrowUp, ArrowDown } from "@phosphor-icons/react";
import type { WidgetConfig, WidgetId } from "@/hooks/useWidgetLayout";

interface WidgetLayoutSettingsProps {
  layout: WidgetConfig[];
  onSetVisible: (id: WidgetId, visible: boolean) => void;
  onMoveUp: (id: WidgetId) => void;
  onMoveDown: (id: WidgetId) => void;
}

export function WidgetLayoutSettings({
  layout,
  onSetVisible,
  onMoveUp,
  onMoveDown,
}: WidgetLayoutSettingsProps) {
  return (
    <div className="flex flex-col gap-1">
      {layout.map((widget, idx) => (
        <div
          key={widget.id}
          className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 transition-colors"
        >
          {/* Visibility toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={widget.visible}
            aria-label={`Toggle ${widget.label}`}
            onClick={() => onSetVisible(widget.id, !widget.visible)}
            className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
              widget.visible ? "bg-[#CD8407]" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                widget.visible ? "translate-x-[14px]" : "translate-x-0.5"
              }`}
            />
          </button>

          {/* Label */}
          <span
            className={`flex-1 text-[12px] font-medium ${
              widget.visible ? "text-gray-700" : "text-gray-400"
            }`}
          >
            {widget.label}
          </span>

          {/* Up / Down controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={`Move ${widget.label} up`}
              disabled={idx === 0}
              onClick={() => onMoveUp(widget.id)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ArrowUp size={10} weight="bold" />
            </button>
            <button
              type="button"
              aria-label={`Move ${widget.label} down`}
              disabled={idx === layout.length - 1}
              onClick={() => onMoveDown(widget.id)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ArrowDown size={10} weight="bold" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
