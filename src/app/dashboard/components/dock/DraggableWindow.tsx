"use client";

import { useState, type ReactNode } from "react";
import { Rnd } from "react-rnd";

interface DraggableWindowProps {
  children: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export function DraggableWindow({
  children,
  defaultWidth = 780,
  defaultHeight = 580,
  minWidth = 400,
  minHeight = 300,
}: DraggableWindowProps) {
  const [defaultPos] = useState(() => {
    const dockWidth = 176;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = dockWidth + Math.max(0, (vw - dockWidth - defaultWidth) / 2);
    const y = Math.max(20, (vh - 56 - defaultHeight) / 2);
    return { x, y, width: defaultWidth, height: defaultHeight };
  });

  return (
    <Rnd
      default={defaultPos}
      minWidth={minWidth}
      minHeight={minHeight}
      bounds="parent"
      style={{ pointerEvents: "auto" }}
    >
      {children}
    </Rnd>
  );
}
