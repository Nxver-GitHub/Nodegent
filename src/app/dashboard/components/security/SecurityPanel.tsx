"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Lock } from "@phosphor-icons/react";
import { AccessToggleCard } from "../AccessToggleCard";
import { ConfirmDialog } from "../ConfirmDialog";

export function SecurityPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Security</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage what Nodegent can access, and revoke access instantly.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Back to dashboard
        </button>
      </div>

      <AccessToggleCard />

      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} weight="bold" className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Instant Access Revocation</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Revoke access to connected systems. This removes synced data from Nodegent but does not
          delete anything from the source system.
        </p>
        <div className="space-y-4">
          <CanvasRevocationRow />
          <GoogleCalendarRevocationRow />
        </div>
      </div>
    </div>
  );
}

function CanvasRevocationRow() {
  const status = useQuery(api.canvas.getCanvasStatus);
  const revokeAccess = useMutation(api.canvas.revokeCanvasAccess);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  async function handleConfirm() {
    setIsRevoking(true);
    try {
      await revokeAccess({});
    } finally {
      setIsRevoking(false);
      setShowConfirm(false);
    }
  }

  if (status === undefined) {
    return (
      <div className="rounded-md border bg-gray-50 px-4 py-3">
        <p className="text-sm text-gray-600">Loading Canvas status…</p>
      </div>
    );
  }

  if (!status?.isConnected) {
    return (
      <div className="rounded-md border bg-gray-50 px-4 py-3">
        <p className="text-sm font-medium text-gray-900">Canvas LMS</p>
        <p className="text-xs text-gray-500 mt-0.5">Not connected.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Canvas LMS</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Connected to {status.canvasBaseUrl}
          </p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Revoke Canvas
        </button>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Revoke Canvas access?"
        message="This will permanently delete all your synced Canvas courses and assignments from Nodegent. Your data on Canvas itself is not affected. This cannot be undone."
        confirmLabel="Revoke Access"
        isLoading={isRevoking}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

function GoogleCalendarRevocationRow() {
  const status = useQuery(api.googleCalendar.getCalendarSyncStatus);
  const revokeAccess = useMutation(api.googleCalendar.revokeCalendarAccess);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  async function handleConfirm() {
    setIsRevoking(true);
    try {
      await revokeAccess({});
    } finally {
      setIsRevoking(false);
      setShowConfirm(false);
    }
  }

  if (status === undefined) {
    return (
      <div className="rounded-md border bg-gray-50 px-4 py-3">
        <p className="text-sm text-gray-600">Loading Google Calendar status…</p>
      </div>
    );
  }

  const lastSync = status?.lastCalendarSyncAt
    ? new Date(status.lastCalendarSyncAt).toLocaleString()
    : null;

  if (!lastSync) {
    return (
      <div className="rounded-md border bg-gray-50 px-4 py-3">
        <p className="text-sm font-medium text-gray-900">Google Calendar</p>
        <p className="text-xs text-gray-500 mt-0.5">No calendar sync detected yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Google Calendar</p>
          <p className="text-xs text-gray-500 mt-0.5">Last synced: {lastSync}</p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Revoke Google
        </button>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Revoke Google Calendar access?"
        message="This will permanently delete all synced Google Calendar events from Nodegent. Your events on Google Calendar are not affected. This cannot be undone."
        confirmLabel="Revoke Access"
        isLoading={isRevoking}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

