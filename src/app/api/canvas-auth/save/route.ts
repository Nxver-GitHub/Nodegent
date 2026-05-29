/**
 * POST /api/canvas-auth/save
 * --------------------------
 * Consumes the server-side extracted Canvas session cookies and stores them
 * in Convex. Called by the UI after receiving the 'done' SSE event.
 *
 * Security:
 *  - Requires Clerk auth.
 *  - Cookies come from server-side state (canvas-sso-state) — never from the request body.
 *  - Authenticates to Convex via Clerk session token (Convex integration enabled in Clerk dashboard).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { consumePendingCookies } from "@/lib/canvas-sso-state";

const UNIVERSITY_CANVAS_URLS: Record<string, string> = {
  ucsc: "https://canvas.ucsc.edu",
  ucberkeley: "https://bcourses.berkeley.edu",
  ucla: "https://bruinlearn.ucla.edu",
  ucsd: "https://canvas.ucsd.edu",
  ucdavis: "https://canvas.ucdavis.edu",
  stanford: "https://canvas.stanford.edu",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let canvasBaseUrl: string | undefined;
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.university === "string" && body.university in UNIVERSITY_CANVAS_URLS) {
      canvasBaseUrl = UNIVERSITY_CANVAS_URLS[body.university];
    }
  } catch {
    // body is optional — ignore parse errors
  }

  const cookies = consumePendingCookies(userId);
  if (!cookies) {
    return NextResponse.json(
      {
        error:
          "No cookies available to save. The auth session may have expired or the cookies were already saved.",
      },
      { status: 409 }
    );
  }

  try {
    await fetchAction(
      api.canvas.saveCanvasCookies,
      { cookiesJson: JSON.stringify(cookies), canvasBaseUrl },
      { token }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save Canvas credentials",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
