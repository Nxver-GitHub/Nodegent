"use client";

import { Rnd } from "react-rnd";
import { X } from "@phosphor-icons/react";

interface IframeWindowProps {
  url: string;
  label: string;
  onClose: () => void;
}

export function IframeWindow({ url, label, onClose }: IframeWindowProps) {
  return (
    <Rnd
      default={{ x: 220, y: 30, width: 900, height: 600 }}
      minWidth={400}
      minHeight={300}
      bounds="parent"
      dragHandleClassName="iframe-drag-handle"
      style={{ pointerEvents: "auto" }}
    >
      <div className="flex flex-col w-full h-full rounded-lg border border-gray-300 bg-white shadow-xl overflow-hidden">
        <div className="iframe-drag-handle h-10 bg-[#F6F6F6] border-b border-gray-300 flex items-center justify-between px-3 flex-shrink-0 cursor-grab active:cursor-grabbing select-none">
          <span className="text-[13px] font-bold text-gray-800">{label}</span>
          <button
            onClick={onClose}
            aria-label={`Close ${label}`}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
        <iframe
          src={url}
          className="flex-1 w-full border-none"
          title={label}
        />
      </div>
    </Rnd>
  );
}
