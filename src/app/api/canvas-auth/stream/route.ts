/**
 * GET /api/canvas-auth/stream
 * ---------------------------
 * Server-Sent Events stream that mirrors the headless Playwright browser.
 *
 * Event types pushed to the client:
 *  status  — { message: string }           Human-readable progress message
 *  frame   — base64 JPEG string            Browser screenshot
 *  done    — { success: true, sessionRestored: boolean }
 *  error   — { message: string }           Fatal error; stream ends
 *
 * Security:
 *  - Requires Clerk auth.
 *  - Starts the Playwright worker only after the SSE connection is live so
 *    no messages are lost.
 *  - Cookies extracted by Playwright are stored server-side only and never
 *    appear in this stream.
 */

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  startSession,
  terminateSession,
  setStreamingPaused,
} from "@/lib/canvas-sso-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function enqueue(event: string, data: unknown) {
        if (controller.desiredSize === null) return; // stream already closed
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

      const started = startSession(userId, enqueue, close);
      if (!started) {
        enqueue("error", {
          message:
            "No pending auth session found. Please submit your credentials first.",
        });
        close();
        return;
      }

      // Handle page visibility changes forwarded by the client
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
