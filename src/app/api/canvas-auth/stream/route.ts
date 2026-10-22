/**
 * POST /api/canvas-auth/stream
 * ----------------------------
 * Single endpoint that accepts Canvas credentials, runs the headless Playwright
 * browser, and saves the extracted session cookies to Convex — all within one
 * long-lived SSE connection.
 *
 * Replaces the old three-route pattern (start → stream → save) to avoid
 * cross-instance state loss on Vercel Fluid Compute. Viewer input (clicks,
 * Duo passcodes) reaches this instance via the Convex relay.
 *
 * Event types pushed to the client:
 *  status  — { message: string }                       Human-readable progress
 *  frame   — base64 JPEG string                        Browser screenshot
 *  done    — { success: true, sessionRestored: boolean }
 *  error   — { message: string }                       Fatal error; stream ends
 *
 * Security:
 *  - Requires Clerk auth.
 *  - Credentials are passed directly to the worker thread and never stored.
 *  - Cookies are saved server-to-Convex; they never appear in the SSE stream.
 *  - Cross-instance per-user rate limit + a global cap on concurrent browsers.
 */

import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  startSession,
  terminateSession,
  terminateSessionIfCurrent,
  SUPERSEDED_MESSAGE,
} from "@/lib/canvas-sso-state";
import {
  acquireBrowserLease,
  enforceRateLimit,
  getInternalSecret,
  releaseBrowserLease,
} from "@/lib/convex-internal";
import { beginSsoSession, endSsoSession } from "@/lib/sso-input-relay";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — allows time for Playwright + Duo MFA

const MAX_INPUT_LEN = 256;
/** Lease outlives maxDuration slightly; it's released early on completion. */
const BROWSER_LEASE_TTL_MS = (maxDuration + 5) * 1000;
/** End the login cleanly just before Vercel would kill the function. */
const STREAM_DEADLINE_MS = (maxDuration - 10) * 1000;

export async function POST(request: NextRequest): Promise<Response> {
  const { userId, getToken } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await getToken();
  if (!token) return new Response("Unauthorized", { status: 401 });

  const limited = await enforceRateLimit("canvasStream", userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return new Response("Request body must be an object", { status: 400 });
  }

  const { username, password, university } = body as Record<string, unknown>;

  if (typeof username !== "string" || typeof password !== "string") {
    return new Response("username and password are required strings", { status: 400 });
  }

  const trimmedUsername = username.trim().slice(0, MAX_INPUT_LEN);
  const trimmedPassword = password.slice(0, MAX_INPUT_LEN);

  if (!trimmedUsername || !trimmedPassword) {
    return new Response("Username and password are required", { status: 400 });
  }

  if (
    trimmedUsername.length === MAX_INPUT_LEN ||
    trimmedPassword.length === MAX_INPUT_LEN
  ) {
    return new Response("Input too long", { status: 400 });
  }

  // The SSO worker only knows the UCSC login flow, and Convex only accepts
  // canvas.ucsc.edu cookies. Other campuses are backlog (multi-campus support);
  // reject them here so their credentials are never typed into UCSC's SSO form.
  if (university !== undefined && university !== null && university !== "ucsc") {
    return Response.json(
      { error: "Canvas login is currently only supported for UC Santa Cruz" },
      { status: 400 }
    );
  }

  // Terminate any zombie session from a prior timed-out or disconnected attempt
  terminateSession(userId, SUPERSEDED_MESSAGE);

  const sessionId = randomUUID();
  let leaseId: Id<"browserLeases"> | null;
  try {
    // Create the user row now, while the Clerk token is fresh — the final
    // cookie save runs minutes later via the internal secret instead.
    await fetchMutation(api.users.ensureUser, {}, { token });
    leaseId = await acquireBrowserLease("canvasSso", userId, BROWSER_LEASE_TTL_MS);
  } catch (err) {
    console.error("[canvas-auth] setup failed:", err);
    return Response.json(
      { error: "Could not start Canvas login. Please try again." },
      { status: 500 }
    );
  }
  if (!leaseId) {
    return Response.json(
      { error: "Canvas login is busy right now. Please try again in a minute." },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
  const heldLease: Id<"browserLeases"> = leaseId;

  // Releases everything this stream holds; idempotent, safe from any path.
  let cleanedUp = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  function cleanup(): void {
    if (cleanedUp) return;
    cleanedUp = true;
    clearTimeout(deadline);
    void releaseBrowserLease(heldLease);
    void endSsoSession(userId!, sessionId);
  }

  try {
    // Supersede any older stream (possibly on another instance) so it can't
    // claim this attempt's clicks/passcodes.
    await beginSsoSession(userId, sessionId);
  } catch (err) {
    console.error("[canvas-auth] session register failed:", err);
    cleanup();
    return Response.json(
      { error: "Could not start Canvas login. Please try again." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function enqueue(event: string, data: unknown) {
        if (controller.desiredSize === null) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller already closed — ignore
        }
      }

      function close() {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }

      async function onSave(cookies: object[]): Promise<void> {
        await fetchAction(api.canvas.saveCanvasCookiesFromServer, {
          secret: getInternalSecret(),
          clerkId: userId!,
          cookiesJson: JSON.stringify(cookies),
        });
      }

      if (request.signal.aborted) {
        cleanup();
        close();
        return;
      }

      let started = false;
      try {
        started = startSession(
          userId,
          sessionId,
          trimmedUsername,
          trimmedPassword,
          enqueue,
          close,
          onSave,
          cleanup
        );
      } catch (err) {
        console.error("[canvas-auth] start failed:", err);
      }

      if (!started) {
        enqueue("error", { message: "Failed to start auth session." });
        close();
        return;
      }

      deadline = setTimeout(() => {
        enqueue("error", { message: "Canvas login timed out. Please try again." });
        terminateSessionIfCurrent(userId, sessionId);
        close();
      }, STREAM_DEADLINE_MS);

      request.signal.addEventListener("abort", () => {
        terminateSessionIfCurrent(userId, sessionId);
        close();
      });
    },

    cancel() {
      terminateSessionIfCurrent(userId, sessionId);
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
