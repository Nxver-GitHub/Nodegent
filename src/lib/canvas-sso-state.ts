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
 *  - Credentials (username/password) are never stored here; they go straight
 *    to the worker via workerData and are cleared when the worker exits.
 *  - Extracted cookies are stored transiently in pendingCookies and consumed
 *    exactly once by the /api/canvas-auth/save route. They never reach the
 *    browser.
 */

import { Worker } from "node:worker_threads";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnqueueFn = (event: string, data: unknown) => void;
type CloseFn = () => void;

interface AuthSession {
  worker: Worker;
  enqueue: EnqueueFn | null;
  close: CloseFn | null;
  abortController: AbortController;
  createdAt: number;
}

interface PendingCredentials {
  username: string;
  password: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const activeSessions = new Map<string, AuthSession>();
const pendingCredentials = new Map<string, PendingCredentials>();
/**
 * Cookies extracted by the worker, keyed by userId.
 * Stored separately from activeSessions so they survive terminateSession()
 * (which may be called by the ReadableStream cancel() before /save fires).
 */
const extractedCookies = new Map<string, object[]>();

/** 30 s — unclaimed credentials expire if the SSE stream never connects */
const PENDING_TTL_MS = 30_000;
/** 10 min — session cleanup guard for stale entries */
const SESSION_MAX_AGE_MS = 10 * 60 * 1000;

// Prune stale entries periodically (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [userId, creds] of pendingCredentials) {
    if (now - creds.createdAt > PENDING_TTL_MS) {
      pendingCredentials.delete(userId);
    }
  }
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Stage credentials for a user. The actual worker is not started until
 * the SSE stream connects and calls startSession().
 */
export function stageCredentials(userId: string, username: string, password: string): void {
  if (activeSessions.has(userId)) {
    throw new Error("An auth session is already in progress for this account.");
  }
  pendingCredentials.set(userId, { username, password, createdAt: Date.now() });
}

/**
 * Claim staged credentials and start the Playwright worker.
 * Must be called from the SSE stream route so messages arrive before any
 * frames are missed.
 *
 * Returns false if no staged credentials are found (expired or not staged).
 */
export function startSession(
  userId: string,
  enqueue: EnqueueFn,
  close: CloseFn
): boolean {
  const creds = pendingCredentials.get(userId);
  if (!creds || Date.now() - creds.createdAt > PENDING_TTL_MS) {
    pendingCredentials.delete(userId);
    return false;
  }
  pendingCredentials.delete(userId);

  // Overwrite any zombie session for this user
  terminateSession(userId);

  const abortController = new AbortController();
  const workerData = buildWorkerData(creds.username, creds.password);

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
    handleWorkerMessage(userId, msg);
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

function handleWorkerMessage(userId: string, msg: Record<string, unknown>): void {
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
      // Store cookies in the separate map so they survive terminateSession()
      const cookies = msg.cookies as object[] | undefined;
      if (Array.isArray(cookies) && cookies.length > 0) {
        extractedCookies.set(userId, cookies);
        enqueue?.("done", { success: true, sessionRestored: msg.sessionRestored ?? false });
      } else {
        enqueue?.("error", { message: "No Canvas session cookies were extracted." });
      }
      // Safe to terminate the session now — cookies are in extractedCookies
      terminateSession(userId);
      close?.();
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

/**
 * Consume the extracted cookies for a user exactly once.
 * Returns null if no cookies are staged (already consumed or session gone).
 */
export function consumePendingCookies(userId: string): object[] | null {
  const cookies = extractedCookies.get(userId);
  if (!cookies) return null;
  extractedCookies.delete(userId);
  return cookies;
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
