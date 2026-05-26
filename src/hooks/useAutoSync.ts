"use client";

import { useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import type { Doc } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";

interface UseAutoSyncOptions {
  sessionId: string | null;
  user: Doc<"users"> | null | undefined;
}

const AUTO_SYNC_KEY_PREFIX = "nodegent-auto-synced-";
const CLIENT_RATE_LIMIT_MS = 15 * 60 * 1000;

export function useAutoSync({ sessionId, user }: UseAutoSyncOptions): void {
  const syncCanvas = useAction(api.canvas.syncCanvas);
  const canvasStatus = useQuery(api.canvas.getCanvasStatus);
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) return;
    if (user === undefined) return;
    if (hasFiredRef.current) return;

    // If Canvas is enabled, wait until canvasStatus has resolved so we can
    // check connectivity before committing the once-per-session flag.
    const needsCanvasStatus = user?.canvasEnabled === true;
    if (needsCanvasStatus && canvasStatus === undefined) return;

    const storageKey = AUTO_SYNC_KEY_PREFIX + sessionId;
    if (sessionStorage.getItem(storageKey) === "1") {
      hasFiredRef.current = true;
      return;
    }

    // Set flag before any async work — prevents StrictMode double-invoke and
    // re-render races from triggering duplicate syncs.
    sessionStorage.setItem(storageKey, "1");
    hasFiredRef.current = true;

    const now = Date.now();

    if (user?.canvasEnabled === true && canvasStatus) {
      const ready = canvasStatus.isConnected && !canvasStatus.needsReconnect;
      const fresh =
        canvasStatus.lastSyncedAt !== undefined &&
        now - canvasStatus.lastSyncedAt < CLIENT_RATE_LIMIT_MS;

      if (ready && !fresh) {
        syncCanvas({}).catch(() => {
          // Error persists in Convex — surfaces via the US-5.4 Canvas status chip
        });
      }
    }

    if (user?.calendarEnabled === true) {
      const lastSync = user.lastCalendarSyncAt;
      const fresh =
        lastSync !== undefined && now - lastSync < CLIENT_RATE_LIMIT_MS;

      if (!fresh) {
        fetch("/api/google-calendar/sync", { method: "POST" }).catch(() => {
          // Error persists in Convex — surfaces via the US-5.4 Calendar status chip
        });
      }
    }
  }, [sessionId, user, canvasStatus, syncCanvas]);
}
