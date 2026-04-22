/**
 * POST /api/canvas-auth/pause
 * ---------------------------
 * Pauses or resumes screenshot streaming when the user hides/shows the tab.
 * Avoids wasting Chromium CPU on screenshots nobody is watching.
 *
 * Body: { paused: boolean }
 *
 * Security: Requires Clerk auth. No-op if no active session exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { setStreamingPaused } from "@/lib/canvas-sso-state";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  setStreamingPaused(userId, paused);
  return NextResponse.json({ ok: true });
}
