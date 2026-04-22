/**
 * POST /api/canvas-auth/click
 * ---------------------------
 * Forwards a click from the browser-mirror UI to the headless Playwright page.
 *
 * Body: { x: number, y: number, viewportWidth: number, viewportHeight: number }
 *
 * Security:
 *  - Requires Clerk auth.
 *  - All coordinates are validated as finite numbers before forwarding.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { forwardClick } from "@/lib/canvas-sso-state";

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

  const { x, y, viewportWidth, viewportHeight } = body as Record<string, unknown>;

  if (
    [x, y, viewportWidth, viewportHeight].some(
      (v) => typeof v !== "number" || !isFinite(v) || v < 0
    )
  ) {
    return NextResponse.json(
      { error: "x, y, viewportWidth, viewportHeight must be non-negative finite numbers" },
      { status: 400 }
    );
  }

  try {
    forwardClick(
      userId,
      x as number,
      y as number,
      viewportWidth as number,
      viewportHeight as number
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Click forwarding failed" },
      { status: 409 }
    );
  }
}
