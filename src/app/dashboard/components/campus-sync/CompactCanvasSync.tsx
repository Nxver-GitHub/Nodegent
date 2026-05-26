"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { CanvasAuthViewer } from "../CanvasAuthViewer";

type ChipStatus = "connected" | "expired" | "error" | "disconnected";

function StatusChip({ status, label }: { status: ChipStatus; label: string }) {
  const styles: Record<ChipStatus, string> = {
    connected: "bg-green-50 border-green-200 text-green-700",
    expired: "bg-amber-50 border-amber-200 text-amber-700",
    error: "bg-red-50 border-red-200 text-red-700",
    disconnected: "bg-gray-100 border-gray-200 text-gray-600",
  };
  const dots: Record<ChipStatus, string> = {
    connected: "bg-green-400",
    expired: "bg-amber-400",
    error: "bg-red-400",
    disconnected: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dots[status]}`} />
      {label}
    </span>
  );
}

/** Exported for US-5.5 auto-sync: returns whether a background Canvas sync should be triggered. */
export function useCanvasSyncEligibility() {
  const status = useQuery(api.canvas.getCanvasStatus);
  return {
    shouldSync: status !== undefined && status !== null && status.isConnected && !status.needsReconnect,
    isLoading: status === undefined,
  };
}

export function CompactCanvasSync() {
  const status = useQuery(api.canvas.getCanvasStatus);
  const syncCanvas = useAction(api.canvas.syncCanvas);
  const searchParams = useSearchParams();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (searchParams.get("reconnect") === "canvas" && status?.needsReconnect) {
      setShowAuth(true);
    }
  }, [searchParams, status?.needsReconnect]);

  async function handleSync() {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await syncCanvas({});
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  // Loading skeleton
  if (status === undefined) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
      </div>
    );
  }

  // Not connected at all — show inline auth flow
  if (!status) {
    return (
      <div className="py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800">Canvas</span>
          <StatusChip status="disconnected" label="Not connected" />
        </div>
        <CanvasAuthViewer onConnected={handleSync} />
      </div>
    );
  }

  const needsReconnect = status.needsReconnect === true;
  const hasError =
    (status.lastSyncStatus === "error" && !!status.lastSyncError) || !!syncError;

  let chipStatus: ChipStatus = "connected";
  let chipLabel = "Connected";
  if (needsReconnect) { chipStatus = "expired"; chipLabel = "Session expired"; }
  else if (hasError) { chipStatus = "error"; chipLabel = "Sync error"; }

  const lastSync = status.lastSyncedAt
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.round((Date.now() - status.lastSyncedAt) / 60000),
        "minute"
      )
    : null;

  const subtitle = [
    lastSync ? `Last sync ${lastSync}` : "Never synced",
    status.coursesSynced !== undefined && `${status.coursesSynced} courses`,
    status.assignmentsSynced !== undefined && `${status.assignmentsSynced} assignments`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div id="canvas-card" className="scroll-mt-6">
      <div className="flex items-center justify-between py-3">
        <div className="min-w-0 mr-3">
          <span className="text-sm font-semibold text-gray-800">Canvas</span>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusChip status={chipStatus} label={chipLabel} />
          {needsReconnect ? (
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs font-medium text-[#CD8407] hover:underline underline-offset-2"
            >
              Reconnect
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              aria-label={isSyncing ? "Syncing Canvas…" : "Re-sync Canvas"}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40 transition-colors"
            >
              <ArrowsClockwise
                size={15}
                weight="bold"
                className={isSyncing ? "animate-spin" : ""}
              />
            </button>
          )}
        </div>
      </div>

      {/* Inline error messages */}
      {hasError && (
        <p className="text-xs text-red-600 pb-2">
          {status.lastSyncError ?? syncError}
        </p>
      )}

      {/* Inline auth viewer for reconnect / initial connect */}
      {showAuth && (
        <div className="pb-3">
          <CanvasAuthViewer
            onConnected={() => {
              setShowAuth(false);
              void handleSync();
            }}
          />
        </div>
      )}
    </div>
  );
}
