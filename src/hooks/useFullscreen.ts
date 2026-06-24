"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Fullscreen support is fixed for the page lifetime, so the store never notifies.
const subscribeNoop = (): (() => void) => () => {};

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function detectSupport(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FullscreenElement;
  return (
    typeof el.requestFullscreen === "function" ||
    typeof el.webkitRequestFullscreen === "function"
  );
}

/**
 * Toggles browser fullscreen for the whole page (document element).
 *
 * - Syncs `isFullscreen` with the native `fullscreenchange` event, so pressing
 *   Escape (which the browser handles itself) keeps the UI state correct.
 * - Falls back to the `webkit` prefixed API for desktop Safari.
 * - `isSupported` is false where the API is unavailable (e.g. iOS Safari), so
 *   callers can hide the control.
 */
export function useFullscreen(): {
  isFullscreen: boolean;
  isSupported: boolean;
  toggleFullscreen: () => void;
} {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Returns the server snapshot (false) during SSR and the initial hydration
  // render, then the real client value — hydration-safe, with no mismatch from
  // reading `document` during render.
  const isSupported = useSyncExternalStore(subscribeNoop, detectSupport, () => false);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(getFullscreenElement() !== null);
    }

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as FullscreenDocument;

    if (getFullscreenElement() !== null) {
      const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
      void Promise.resolve(exit?.call(doc)).catch(() => {});
      return;
    }

    const el = document.documentElement as FullscreenElement;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    void Promise.resolve(request?.call(el)).catch(() => {});
  }, []);

  return { isFullscreen, isSupported, toggleFullscreen };
}
