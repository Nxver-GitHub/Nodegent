/**
 * canvas-sso-state.ts
 * -------------------
 * Module-level singleton that manages active Canvas SSO auth sessions.
 *
 * Keyed by Clerk userId so multiple users can auth concurrently without
 * cross-contamination. Lives in the Next.js Node.js process — works in
 * local dev (single process). Not suitable for multi-instance deployments.
 *
 * Security notes:
 *  - Credentials (username/password) are passed directly to the worker via
 *    workerData and are cleared when the worker exits. They are never stored
 *    in this module.
 *  - Cookies are saved to Convex via the onSave callback provided by the
 *    route handler. They never reach the browser.
 */

import { Worker } from "node:worker_threads";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnqueueFn = (event: string, data: unknown) => void;
type CloseFn = () => void;
type OnSaveFn = (cookies: object[]) => Promise<void>;

interface AuthSession {
  worker: Worker;
  enqueue: EnqueueFn | null;
  close: CloseFn | null;
  abortController: AbortController;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const activeSessions = new Map<string, AuthSession>();

/** 10 min — session cleanup guard for stale entries */
const SESSION_MAX_AGE_MS = 10 * 60 * 1000;

// Prune stale sessions periodically (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of activeSessions) {
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
      terminateSession(userId);
    }
  }
}, 5 * 60_000).unref();

// ---------------------------------------------------------------------------
// Worker config — passed via workerData to avoid TypeScript imports in worker
// ---------------------------------------------------------------------------

const WORKER_PATH = path.join(process.cwd(), "src", "lib", "sso-auth-worker.js");

function buildWorkerData(username: string, password: string) {
  return {
    mode: "auth",
    username,
    password,
    canvasBaseUrl: "https://canvas.ucsc.edu",
    canvasSsoUrl:
      "https://canvas.ucsc.edu/login/instructure?authentication_provider=5",
    sessionDir: path.join(process.cwd(), ".browser-session"),
    ssoTimeoutMs: 90_000,
    sessionCheckMs: Number(process.env.SESSION_CHECK_MS ?? 2_000),
    playwrightOptions: {
      headless: process.env.HEADLESS !== "false",
      viewport: { width: 960, height: 700 },
    },
    screenshotIntervalMs: Number(process.env.SCREENSHOT_INTERVAL_MS ?? 2_500),
    screenshotQuality: Number(process.env.SCREENSHOT_QUALITY ?? 35),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function handleWorkerMessage(
  userId: string,
  msg: Record<string, unknown>,
  onSave: OnSaveFn
): void {
  const session = activeSessions.get(userId);
  if (!session) return;

  const { enqueue, close } = session;

  switch (msg.type) {
    case "status":
      enqueue?.("status", { message: msg.message });
      break;

    case "frame":
      enqueue?.("frame", msg.data);
      break;

    case "playwright-ready":
      // Internal — no need to forward to client
      break;

    case "done": {
      const cookies = msg.cookies as object[] | undefined;
      if (Array.isArray(cookies) && cookies.length > 0) {
        terminateSession(userId);
        // Save to Convex via the callback provided by the route handler
        onSave(cookies)
          .then(() => {
            enqueue?.("done", { success: true, sessionRestored: msg.sessionRestored ?? false });
            close?.();
          })
          .catch(() => {
            enqueue?.("error", { message: "Failed to save Canvas session. Please try again." });
            close?.();
          });
      } else {
        enqueue?.("error", { message: "No Canvas session cookies were extracted." });
        terminateSession(userId);
        close?.();
      }
      break;
    }

    case "error":
      enqueue?.("error", { message: msg.message });
      terminateSession(userId);
      close?.();
      break;

    case "click-result":
      // Handled inline in forwardClick — no SSE forwarding needed
      break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the Playwright worker directly with the provided credentials.
 * The onSave callback is called with the extracted cookies when auth succeeds,
 * saving them to Convex without ever exposing them to the browser.
 *
 * Returns false if a session is already active (should not happen as callers
 * check hasActiveSession first).
 */
export function startSession(
  userId: string,
  username: string,
  password: string,
  enqueue: EnqueueFn,
  close: CloseFn,
  onSave: OnSaveFn
): boolean {
  // Overwrite any zombie session
  terminateSession(userId);

  const abortController = new AbortController();
  const workerData = buildWorkerData(username, password);
  const worker = new Worker(WORKER_PATH, { workerData });

  const session: AuthSession = {
    worker,
    enqueue,
    close,
    abortController,
    createdAt: Date.now(),
  };
  activeSessions.set(userId, session);

  worker.on("message", (msg: Record<string, unknown>) => {
    handleWorkerMessage(userId, msg, onSave);
  });

  worker.on("error", (err: Error) => {
    enqueue("error", { message: `Browser error: ${err.message}` });
    terminateSession(userId);
    close();
  });

  worker.on("exit", (code: number) => {
    if (code !== 0 && activeSessions.has(userId)) {
      enqueue("error", { message: "Browser process exited unexpectedly." });
      terminateSession(userId);
      close();
    }
  });

  return true;
}

/**
 * Forward a click from the viewer UI to the headless browser.
 */
export function forwardClick(
  userId: string,
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number
): void {
  const session = activeSessions.get(userId);
  if (!session) throw new Error("No active auth session.");
  const id = Date.now();
  session.worker.postMessage({ type: "click", id, x, y, viewportWidth, viewportHeight });
}

/**
 * Pause or resume screenshot streaming (e.g. when tab is hidden).
 */
export function setStreamingPaused(userId: string, paused: boolean): void {
  activeSessions.get(userId)?.worker.postMessage({ type: "pause", paused });
}

/**
 * Abort and clean up a session for a user.
 */
export function terminateSession(userId: string): void {
  const session = activeSessions.get(userId);
  if (!session) return;
  activeSessions.delete(userId);
  session.worker.postMessage({ type: "abort" });
  session.worker.terminate().catch(() => {});
}

export function hasActiveSession(userId: string): boolean {
  return activeSessions.has(userId);
}
