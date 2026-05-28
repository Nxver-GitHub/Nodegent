"use client";

import { Rnd } from "react-rnd";
import { X, Minus, Square } from "@phosphor-icons/react";

interface IframeWindowProps {
  url: string;
  label: string;
  phosphorIcon: string;
  color: string;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  isMaximized: boolean;
  isMinimizing: boolean;
}

export function IframeWindow({
  url,
  label,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  isMaximized,
  isMinimizing,
}: IframeWindowProps) {
  const titleBar = (
    <div onMouseDown={onFocus} className="iframe-drag-handle h-10 bg-[#F6F6F6] border-b border-gray-300 flex items-center justify-between px-3 flex-shrink-0 cursor-grab active:cursor-grabbing select-none">
      <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{label}</span>
      <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
        <button
          onClick={onMinimize}
          aria-label={`Minimize ${label}`}
          className="w-6 h-6 flex items-center justify-center rounded hover:text-yellow-500 transition-colors"
        >
          <Minus size={12} weight="bold" />
        </button>
        <button
          onClick={onMaximize}
          aria-label={isMaximized ? `Restore ${label}` : `Maximize ${label}`}
          className="w-6 h-6 flex items-center justify-center rounded hover:text-green-500 transition-colors"
        >
          <Square size={11} />
        </button>
        <button
          onClick={onClose}
          aria-label={`Close ${label}`}
          className="w-6 h-6 flex items-center justify-center rounded hover:text-red-500 transition-colors"
        >
          <X size={12} weight="bold" />
        </button>
      </div>
    </div>
  );

  if (isMaximized) {
    return (
      <div
        className="window-shadow absolute inset-0 flex flex-col bg-white overflow-hidden"
        style={{ pointerEvents: "auto" }}
      >
        {titleBar}
        <iframe src={url} className="flex-1 w-full border-none" title={label} />
      </div>
    );
  }

  return (
    <Rnd
      default={{ x: 220, y: 30, width: 900, height: 600 }}
      minWidth={400}
      minHeight={300}
      bounds="parent"
      dragHandleClassName="iframe-drag-handle"
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="window-shadow flex flex-col w-full h-full rounded-lg border border-gray-300 bg-white overflow-hidden"
        style={{
          transition: "transform 280ms ease-in, opacity 280ms ease-in",
          transform: isMinimizing ? "scale(0.05)" : "scale(1)",
          opacity: isMinimizing ? 0 : 1,
          transformOrigin: "top right",
        }}
      >
        {titleBar}
        <iframe src={url} className="flex-1 w-full border-none" title={label} />
      </div>
    </Rnd>
  );
}
