/**
 * POST /api/canvas-auth/save
 * --------------------------
 * Consumes the server-side extracted Canvas session cookies and stores them
 * in Convex (encrypted). Called by the UI after receiving the 'done' SSE event.
 *
 * Security:
 *  - Requires Clerk auth.
 *  - Cookies are consumed from server memory (canvas-sso-state) — they are
 *    never present in the request body, so they never transit the browser.
 *  - Uses fetchAction with a Clerk-issued Convex token so Convex can verify
 *    the user identity server-side before writing.
 */

/**
 * POST /api/canvas-auth/save
 * --------------------------
 * Consumes the server-side extracted Canvas session cookies and stores them
 * in Convex via a shared-secret mutation (no Clerk JWT template required).
 *
 * Security:
 *  - Requires Clerk auth to identify the user.
 *  - Cookies come from server-side state (canvas-sso-state) — never from the request body.
 *  - CONVEX_INTERNAL_SECRET authenticates the server-to-Convex call, replacing
 *    the Clerk "convex" JWT template which is not required in this setup.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { consumePendingCookies } from "@/lib/canvas-sso-state";

export async function POST(request: NextRequest): Promise<NextResponse> {
  void request; // no body needed — cookies come from server-side state

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalSecret = process.env.CONVEX_INTERNAL_SECRET;
  if (!internalSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: CONVEX_INTERNAL_SECRET not set" },
      { status: 500 }
    );
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
    await fetchMutation(api.canvas.saveCanvasCookiesInternal, {
      clerkUserId: userId,
      cookiesJson: JSON.stringify(cookies),
      internalSecret,
    });
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
