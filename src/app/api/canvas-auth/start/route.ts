/**
 * POST /api/canvas-auth/start
 * ---------------------------
 * Validates CruzID + password and stages them for the SSE stream to pick up.
 * Does NOT start Playwright yet — the worker starts only when the SSE stream
 * connects, ensuring no frames are missed.
 *
 * Security:
 *  - Requires Clerk auth.
 *  - Input length is capped to prevent oversized payloads.
 *  - Credentials are stored in server memory only for PENDING_TTL_MS (30 s).
 *  - No credentials are logged or persisted.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stageCredentials, hasActiveSession } from "@/lib/canvas-sso-state";

const MAX_INPUT_LEN = 256;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (hasActiveSession(userId)) {
    return NextResponse.json(
      { error: "An auth session is already in progress. Please wait." },
      { status: 409 }
    );
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

  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "username and password are required strings" },
      { status: 400 }
    );
  }

  const trimmedUsername = username.trim().slice(0, MAX_INPUT_LEN);
  const trimmedPassword = password.slice(0, MAX_INPUT_LEN);

  if (!trimmedUsername || !trimmedPassword) {
    return NextResponse.json(
      { error: "CruzID and password are required" },
      { status: 400 }
    );
  }

  if (
    trimmedUsername.length === MAX_INPUT_LEN ||
    trimmedPassword.length === MAX_INPUT_LEN
  ) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  try {
    stageCredentials(userId, trimmedUsername, trimmedPassword);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start session" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
