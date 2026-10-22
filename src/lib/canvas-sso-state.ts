/**
 * canvas-sso-state.ts
 * -------------------
 * Module-level singleton that manages active Canvas SSO auth sessions.
 *
 * Keyed by Clerk userId so multiple users can auth concurrently without
 * cross-contamination. The worker lives on the instance that serves the SSE
 * stream; viewer input from other instances arrives via the Convex relay
 * (see sso-input-relay.ts), so this works across Vercel instances.
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
import { subscribeSsoInputs, type SsoInput } from "@/lib/sso-input-relay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnqueueFn = (event: string, data: unknown) => void;
type CloseFn = () => void;
type OnSaveFn = (cookies: object[]) => Promise<void>;
type TeardownFn = () => void;

interface AuthSession {
  worker: Worker;
  enqueue: EnqueueFn | null;
  close: CloseFn | null;
  abortController: AbortController;
  createdAt: number;
  /** Stops the input relay and runs the route's cleanup (lease release etc). */
  teardown: TeardownFn;
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

function buildWorkerData(userId: string, username: string, password: string) {
  return {
    mode: "auth",
    username,
    password,
    canvasBaseUrl: "https://canvas.ucsc.edu",
    canvasSsoUrl:
      "https://canvas.ucsc.edu/login/instructure?authentication_provider=5",
    // Per-user profile (local/non-Vercel mode only) so one user's saved Canvas
    // session is never "restored" for another user on a shared host.
    sessionDir: `/tmp/.browser-session-${userId.replace(/[^A-Za-z0-9_-]/g, "")}`,
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

    case "mfa-input-required":
      enqueue?.("mfa-input-required", { variant: msg.variant });
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
 * `onTerminate` runs exactly once when the session ends for any reason
 * (success, error, abort, zombie overwrite, stale sweep) — callers release
 * per-session resources there. It also runs if startup fails.
 *
 * Returns false if the relay or worker could not be started.
 */
export function startSession(
  userId: string,
  sessionId: string,
  username: string,
  password: string,
  enqueue: EnqueueFn,
  close: CloseFn,
  onSave: OnSaveFn,
  onTerminate: TeardownFn
): boolean {
  // Overwrite any zombie session
  terminateSession(userId);

  // Subscribe before spawning Chromium: without the relay, clicks/passcodes
  // can't reach the worker, so fail fast rather than strand the user at Duo.
  let stopRelay: () => void;
  try {
    stopRelay = subscribeSsoInputs(userId, sessionId, (input) =>
      applyRelayedInput(userId, input)
    );
  } catch (err) {
    console.error("[canvas-sso] relay subscribe failed:", err);
    onTerminate();
    return false;
  }

  let tornDown = false;
  const teardown = () => {
    if (tornDown) return;
    tornDown = true;
    stopRelay();
    onTerminate();
  };

  let worker: Worker;
  try {
    worker = new Worker(WORKER_PATH, {
      workerData: buildWorkerData(userId, username, password),
    });
  } catch (err) {
    console.error("[canvas-sso] worker spawn failed:", err);
    teardown();
    return false;
  }

  const session: AuthSession = {
    worker,
    enqueue,
    close,
    abortController: new AbortController(),
    createdAt: Date.now(),
    teardown,
  };
  activeSessions.set(userId, session);

  worker.on("message", (msg: Record<string, unknown>) => {
    handleWorkerMessage(userId, msg, onSave);
  });

  worker.on("error", (err: Error) => {
    console.error("[canvas-sso] worker error:", err);
    enqueue("error", { message: "Browser error. Please try again." });
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

/** Routes one relayed viewer input to this instance's worker for `userId`. */
function applyRelayedInput(userId: string, input: SsoInput): void {
  try {
    if (input.kind === "click") {
      forwardClick(
        userId,
        input.x ?? 0,
        input.y ?? 0,
        input.viewportWidth ?? 0,
        input.viewportHeight ?? 0
      );
    } else if (input.kind === "type" && input.text) {
      forwardType(userId, input.text);
    } else if (input.kind === "pause") {
      setStreamingPaused(userId, input.paused ?? false);
    }
  } catch {
    // Session ended between queue and delivery — nothing to forward to.
  }
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
 * Forward a typed passcode from the UI to the headless browser.
 * Called when Duo falls back to app passcode or SMS passcode entry.
 */
export function forwardType(userId: string, text: string): void {
  const session = activeSessions.get(userId);
  if (!session) throw new Error("No active auth session.");
  session.worker.postMessage({ type: "type-text", text });
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
  session.teardown();
  session.worker.postMessage({ type: "abort" });
  session.worker.terminate().catch(() => {});
}

export function hasActiveSession(userId: string): boolean {
  return activeSessions.has(userId);
}
