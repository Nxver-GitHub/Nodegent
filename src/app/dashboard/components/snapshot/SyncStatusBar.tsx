"use client";

import { ArrowsClockwise, PlugsConnected } from "@phosphor-icons/react";
import Link from "next/link";

interface SyncStatus {
  isConnected: boolean;
  lastSyncedAt?: number;
  lastSyncStatus?: "success" | "error";
}

interface SyncStatusBarProps {
  status: SyncStatus | null | undefined;
  onSync: () => void;
  isSyncing: boolean;
}

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function SyncStatusBar({ status, onSync, isSyncing }: SyncStatusBarProps) {
  if (status === undefined) return null;

  if (!status?.isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <PlugsConnected size={12} />
        <span>Canvas not connected —</span>
        <Link href="/dashboard" className="text-[#CD8407] hover:underline font-medium">
          connect
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-400">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          status.lastSyncStatus === "error" ? "bg-red-400" : "bg-green-400"
        }`}
      />
      <span className="flex-1 font-mono">
        {status.lastSyncedAt ? `Synced ${formatRelative(status.lastSyncedAt)}` : "Not synced"}
      </span>
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="flex items-center gap-1 hover:text-gray-700 disabled:opacity-40 transition-colors"
        title="Sync Canvas now"
      >
        <ArrowsClockwise size={12} className={isSyncing ? "animate-spin" : ""} />
        <span>{isSyncing ? "Syncing…" : "Sync"}</span>
      </button>
    </div>
  );
}
