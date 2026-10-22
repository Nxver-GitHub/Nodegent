/**
 * POST /api/canvas-auth/pause
 * ---------------------------
 * Pauses or resumes screenshot streaming when the user hides/shows the tab.
 * Avoids wasting Chromium CPU on screenshots nobody is watching.
 *
 * Body: { paused: boolean }
 *
 * Security: Requires Clerk auth. Relayed via Convex so it reaches the instance
 * running the browser; no-op if no active session exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/lib/convex-internal";
import { queueSsoInput } from "@/lib/sso-input-relay";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit("canvasInput", userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { paused } = body as Record<string, unknown>;
  if (typeof paused !== "boolean") {
    return NextResponse.json({ error: "paused must be a boolean" }, { status: 400 });
  }

  try {
    const result = await queueSsoInput(userId, { kind: "pause", paused });
    return NextResponse.json({ ok: result.ok });
  } catch (err) {
    console.error("[canvas-auth/pause] relay failed:", err);
    return NextResponse.json({ ok: false });
  }
}
