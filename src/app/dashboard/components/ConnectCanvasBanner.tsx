"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { X } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";

const CONNECT_CANVAS_DISMISSED_KEY = "nodegent-connect-canvas-banner-dismissed";

export function ConnectCanvasBanner({
  onConnect,
}: {
  onConnect: (mode: "connect" | "reconnect") => void;
}) {
  const status = useQuery(api.canvas.getCanvasStatus);
  const user = useQuery(api.users.getCurrentUser);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(CONNECT_CANVAS_DISMISSED_KEY) === "1";
  });

  function handleDismiss() {
    sessionStorage.setItem(CONNECT_CANVAS_DISMISSED_KEY, "1");
    setDismissed(true);
  }

  if (dismissed) return null;
  if (status === undefined || user === undefined) return null;
  if (user?.canvasEnabled === false) return null;

  const isNotConnected = status === null;
  const needsReconnect = status !== null && status.needsReconnect === true;
  if (!isNotConnected && !needsReconnect) return null;

  const title = isNotConnected ? "Connect Canvas" : "Canvas session expired";
  const subtitle = isNotConnected
    ? "Sign in once with your CruzID to pull in your courses and assignments."
    : "Sign back in with your CruzID to keep your courses and assignments in sync.";
  const buttonLabel = isNotConnected ? "Connect" : "Reconnect";
  const mode: "connect" | "reconnect" = isNotConnected ? "connect" : "reconnect";

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900">{title}</p>
        <p className="text-xs text-amber-800 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onConnect(mode)}
          className="rounded-sm bg-[#CD8407] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#A86A05] transition-colors"
        >
          {buttonLabel}
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="rounded p-1 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
