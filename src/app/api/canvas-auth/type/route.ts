/**
 * POST /api/canvas-auth/type
 * --------------------------
 * Forwards a passcode (numeric) from the Nodegent UI to the headless Playwright
 * browser. Used when Duo falls back from push to a 6-digit app passcode or a
 * 7-digit SMS passcode.
 *
 * Body: { text: string }  — digits only; non-digit characters are stripped
 *
 * Security:
 *  - Requires Clerk auth.
 *  - Input is stripped to digits and capped at 16 characters.
 *  - Returns { ok: false } (not 4xx) when no active session exists so the
 *    client can show a graceful retry message rather than a hard error.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { forwardType } from "@/lib/canvas-sso-state";

const MAX_PASSCODE_LEN = 16;

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

  const { text } = body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Strip to digits only — Duo passcodes are always numeric
  const sanitized = text.trim().replace(/\D/g, "").slice(0, MAX_PASSCODE_LEN);
  if (!sanitized) {
    return NextResponse.json({ error: "text must contain at least one digit" }, { status: 400 });
  }

  try {
    forwardType(userId, sanitized);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: "no-session" });
  }
}
