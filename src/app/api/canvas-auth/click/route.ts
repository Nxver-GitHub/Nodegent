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
 *  - Relayed via Convex so it reaches the instance running the browser.
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
    const result = await queueSsoInput(userId, {
      kind: "click",
      x: x as number,
      y: y as number,
      viewportWidth: viewportWidth as number,
      viewportHeight: viewportHeight as number,
    });
    // Best-effort: { ok:false, reason: "no-session" | "busy" } lets the UI retry.
    return NextResponse.json(result);
  } catch (err) {
    console.error("[canvas-auth/click] relay failed:", err);
    return NextResponse.json({ ok: false, reason: "relay-error" });
  }
}
