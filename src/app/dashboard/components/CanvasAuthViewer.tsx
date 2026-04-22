"use client";

import { useEffect, useRef, useState } from "react";

type AuthPhase =
  | "idle"          // showing the CruzID / password form
  | "starting"      // POST /start in flight
  | "streaming"     // SSE connected, showing browser mirror
  | "saving"        // POST /save in flight
  | "connected"     // done — Canvas is now connected
  | "error";        // terminal error

interface CanvasAuthViewerProps {
  /** Called after credentials are successfully saved to Convex */
  onConnected: () => void;
}

export function CanvasAuthViewer({ onConnected }: CanvasAuthViewerProps) {
  const [phase, setPhase] = useState<AuthPhase>("idle");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [statusMsg, setStatusMsg] = useState("Starting browser…");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  // Visibility change — pause screenshots when tab is hidden
  useEffect(() => {
    if (phase !== "streaming") return;

    function handleVisibility() {
      fetch("/api/canvas-auth/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: document.visibilityState !== "visible" }),
      }).catch(() => {});
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setPhase("starting");

    try {
      const startRes = await fetch("/api/canvas-auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!startRes.ok) {
        const data = await startRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to start auth");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to start session");
      setPhase("error");
      return;
    }

    // Credentials staged — now open the SSE stream
    setPhase("streaming");
    setStatusMsg("Starting browser…");

    const es = new EventSource("/api/canvas-auth/stream");
    esRef.current = es;

    es.addEventListener("status", (e) => {
      try {
        const { message } = JSON.parse(e.data) as { message: string };
        if (message) setStatusMsg(message);
      } catch { /* ignore */ }
    });

    es.addEventListener("frame", (e) => {
      // e.data is JSON-encoded (the server calls JSON.stringify on the base64 string)
      const base64 = JSON.parse(e.data as string) as string;
      setFrameSrc(`data:image/jpeg;base64,${base64}`);
    });

    es.addEventListener("done", () => {
      es.close();
      esRef.current = null;
      setStatusMsg("Saving credentials…");
      setPhase("saving");
      saveCredentials();
    });

    es.addEventListener("error", (e) => {
      es.close();
      esRef.current = null;
      try {
        const { message } = JSON.parse((e as MessageEvent).data) as { message?: string };
        setErrorMsg(message ?? "Authentication failed");
      } catch {
        setErrorMsg("Authentication failed — check your CruzID and password");
      }
      setPhase("error");
    });

    // Network-level SSE error (e.g. server closed without sending error event)
    es.onerror = () => {
      if (phase === "streaming") {
        setErrorMsg("Connection to auth stream was lost");
        setPhase("error");
        es.close();
      }
    };
  }

  async function saveCredentials() {
    try {
      const res = await fetch("/api/canvas-auth/save", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to save credentials"
        );
      }
      setPhase("connected");
      onConnected();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save credentials");
      setPhase("error");
    }
  }

  function handleImgClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    fetch("/api/canvas-auth/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
      }),
    }).catch(() => {});
  }

  function handleRetry() {
    esRef.current?.close();
    esRef.current = null;
    setErrorMsg(null);
    setFrameSrc(null);
    setUsername("");
    setPassword("");
    setPhase("idle");
  }

  // --- Render: credential form ---
  if (phase === "idle" || phase === "starting") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-semibold text-gray-900">Connect Canvas via UCSC SSO</h3>
        <p className="mt-1 text-sm text-gray-500">
          Enter your CruzID and Gold Password. A headless browser will log in on
          your behalf — you&apos;ll see the screen live and can approve Duo MFA
          when prompted.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">CruzID</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jdoe"
              required
              disabled={phase === "starting"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Gold Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Gold Password"
              required
              disabled={phase === "starting"}
            />
          </div>
          <p className="text-xs text-gray-400">
            Your credentials are used only to log in and are never stored. Canvas
            session cookies are encrypted and stored server-side.
          </p>
          <button
            type="submit"
            disabled={phase === "starting"}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {phase === "starting" ? "Starting…" : "Connect Canvas"}
          </button>
        </form>
      </div>
    );
  }

  // --- Render: browser mirror ---
  if (phase === "streaming" || phase === "saving") {
    return (
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-sm text-gray-600">{statusMsg}</span>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Click anywhere on the browser below to interact (e.g. approve Duo MFA).
        </p>
        <div className="relative overflow-hidden rounded border border-gray-200 bg-gray-50">
          {frameSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={frameSrc}
              alt="Canvas login browser"
              className="block w-full cursor-crosshair"
              onClick={handleImgClick}
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              Waiting for browser…
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Render: error ---
  if (phase === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h3 className="font-semibold text-red-800">Canvas login failed</h3>
        <p className="mt-1 text-sm text-red-700">{errorMsg}</p>
        <button
          onClick={handleRetry}
          className="mt-4 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          Try again
        </button>
      </div>
    );
  }

  // phase === "connected" — parent re-renders with the status card
  return null;
}
