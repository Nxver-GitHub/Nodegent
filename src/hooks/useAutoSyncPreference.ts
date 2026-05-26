"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nodegent-auto-sync-enabled";

// Default ON. Stored as the literal string "false" only when the user has
// explicitly opted out — any other value (including missing) is treated as on.
function readPreference(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function useAutoSyncPreference(): {
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (next: boolean) => void;
} {
  const [autoSyncEnabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    setEnabled(readPreference());
  }, []);

  function setAutoSyncEnabled(next: boolean) {
    setEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
    }
  }

  return { autoSyncEnabled, setAutoSyncEnabled };
}

// Synchronous read for places that can't use a hook (e.g. inside another effect
// that runs before this hook's mount). Returns the same default as the hook.
export function isAutoSyncEnabled(): boolean {
  return readPreference();
}
