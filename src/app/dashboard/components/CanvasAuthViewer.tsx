"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

type AuthPhase =
  | "idle"          // showing the CruzID / password form
  | "starting"      // POST /stream request in flight (before first event)
  | "streaming"     // SSE connected, showing browser mirror
  | "connected"     // done — Canvas is now connected
  | "error";        // terminal error

interface CanvasAuthViewerProps {
  /** Called after credentials are successfully saved to Convex */
  onConnected: () => void;
}

const UNIVERSITY_COPY: Record<string, { name: string; usernameLabel: string; passwordLabel: string }> = {
  ucsc:       { name: "UC Santa Cruz", usernameLabel: "CruzID",     passwordLabel: "Gold Password" },
  ucberkeley: { name: "UC Berkeley",   usernameLabel: "CalNet ID",  passwordLabel: "Passphrase" },
  ucla:       { name: "UCLA",          usernameLabel: "Login ID",   passwordLabel: "Password" },
  ucsd:       { name: "UC San Diego",  usernameLabel: "SSO Username", passwordLabel: "Password" },
  ucdavis:    { name: "UC Davis",      usernameLabel: "Login ID",   passwordLabel: "Password" },
  stanford:   { name: "Stanford",      usernameLabel: "SUNet ID",   passwordLabel: "Password" },
};

export function CanvasAuthViewer({ onConnected }: CanvasAuthViewerProps) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [phase, setPhase] = useState<AuthPhase>("idle");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [statusMsg, setStatusMsg] = useState("Starting browser…");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Clean up in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
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
    setStatusMsg("Starting browser…");

    const abortController = new AbortController();
    abortRef.current = abortController;

    let response: Response;
    try {
      response = await fetch("/api/canvas-auth/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          university: currentUser?.university ?? undefined,
        }),
        signal: abortController.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setErrorMsg("Failed to connect to auth stream");
      setPhase("error");
      return;
    }

    if (!response.ok || !response.body) {
      let errMsg = "Failed to start auth stream";
      try {
        const data = await response.json() as { error?: string };
        if (data.error) errMsg = data.error;
      } catch { /* ignore */ }
      setErrorMsg(errMsg);
      setPhase("error");
      return;
    }

    setPhase("streaming");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      let currentEvent = "message";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            let data: unknown;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            handleSseEvent(currentEvent, data);
            currentEvent = "message";
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      if (phase === "streaming") {
        setErrorMsg("Connection to auth stream was lost");
        setPhase("error");
      }
    }
  }

  function handleSseEvent(event: string, data: unknown) {
    switch (event) {
      case "status": {
        const { message } = data as { message?: string };
        if (message) setStatusMsg(message);
        break;
      }
      case "frame": {
        // data is JSON-encoded base64 string
        const base64 = data as string;
        setFrameSrc(`data:image/jpeg;base64,${base64}`);
        break;
      }
      case "done": {
        abortRef.current = null;
        setPhase("connected");
        onConnected();
        break;
      }
      case "error": {
        abortRef.current = null;
        const { message } = data as { message?: string };
        setErrorMsg(message ?? "Authentication failed");
        setPhase("error");
        break;
      }
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
    abortRef.current?.abort();
    abortRef.current = null;
    setErrorMsg(null);
    setFrameSrc(null);
    setUsername("");
    setPassword("");
    setPhase("idle");
  }

  // --- Render: credential form ---
  if (phase === "idle" || phase === "starting") {
    const uniCopy = currentUser?.university
      ? (UNIVERSITY_COPY[currentUser.university] ?? { name: currentUser.university, usernameLabel: "Username", passwordLabel: "Password" })
      : { name: null, usernameLabel: "Username", passwordLabel: "Password" };

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-semibold text-gray-900">
          Connect Canvas via {uniCopy.name ? `${uniCopy.name} SSO` : "Campus SSO"}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Enter your {uniCopy.usernameLabel} and {uniCopy.passwordLabel}. A headless
          browser will log in on your behalf — you&apos;ll see the screen live and
          can approve Duo MFA when prompted.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">{uniCopy.usernameLabel}</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={uniCopy.usernameLabel.toLowerCase()}
              required
              disabled={phase === "starting"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {uniCopy.passwordLabel}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={uniCopy.passwordLabel}
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
  if (phase === "streaming") {
    return (
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-sm text-gray-600">{statusMsg}</span>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          When Duo MFA appears, approve it on your phone. Clicking within the preview may not work on the hosted version.
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
