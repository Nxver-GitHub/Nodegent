/**
 * POST /api/canvas-auth/stream
 * ----------------------------
 * Single endpoint that accepts Canvas credentials, runs the headless Playwright
 * browser, and saves the extracted session cookies to Convex — all within one
 * long-lived SSE connection.
 *
 * Replaces the old three-route pattern (start → stream → save) to avoid
 * cross-instance state loss on Vercel Fluid Compute.
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
 */

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import {
  startSession,
  terminateSession,
  setStreamingPaused,
  hasActiveSession,
} from "@/lib/canvas-sso-state";

export const dynamic = "force-dynamic";

const MAX_INPUT_LEN = 256;

const UNIVERSITY_CANVAS_URLS: Record<string, string> = {
  ucsc: "https://canvas.ucsc.edu",
  ucberkeley: "https://bcourses.berkeley.edu",
  ucla: "https://bruinlearn.ucla.edu",
  ucsd: "https://canvas.ucsd.edu",
  ucdavis: "https://canvas.ucdavis.edu",
  stanford: "https://canvas.stanford.edu",
};

export async function POST(request: NextRequest): Promise<Response> {
  const { userId, getToken } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const tokenResult = await getToken();
  if (!tokenResult) return new Response("Unauthorized", { status: 401 });
  const token: string = tokenResult;

  if (hasActiveSession(userId)) {
    return new Response(
      JSON.stringify({ error: "An auth session is already in progress." }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

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

  const canvasBaseUrl =
    typeof university === "string" && university in UNIVERSITY_CANVAS_URLS
      ? UNIVERSITY_CANVAS_URLS[university]
      : undefined;

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
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }

      async function onSave(cookies: object[]): Promise<void> {
        await fetchAction(
          api.canvas.saveCanvasCookies,
          { cookiesJson: JSON.stringify(cookies), canvasBaseUrl },
          { token }
        );
      }

      const started = startSession(
        userId,
        trimmedUsername,
        trimmedPassword,
        enqueue,
        close,
        onSave
      );

      if (!started) {
        enqueue("error", { message: "Failed to start auth session." });
        close();
        return;
      }

      request.signal.addEventListener("abort", () => {
        setStreamingPaused(userId, true);
        terminateSession(userId);
      });
    },

    cancel() {
      terminateSession(userId);
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
