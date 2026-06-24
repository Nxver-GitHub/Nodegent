import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchMcpTool, isMcpTool } from "@/lib/slug-mcp/index";
import { rateLimit } from "@/lib/rate-limit";

// Per-user cap on direct (browser) calls. Trusted server-to-server calls from
// Convex (authenticated by the internal secret) are exempt — they originate from
// the chat action, which is already rate-limited in convex/chat.ts.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Accept either a browser Clerk session OR an internal Convex-to-Next call
  const internalSecret = process.env.CONVEX_INTERNAL_SECRET;
  const callerSecret = request.headers.get("x-nodegent-internal");

  function secretsMatch(a: string, b: string): boolean {
    try {
      const ba = Buffer.from(a);
      const bb = Buffer.from(b);
      return ba.length === bb.length && timingSafeEqual(ba, bb);
    } catch {
      return false;
    }
  }
  const isInternalCall =
    Boolean(internalSecret) && Boolean(callerSecret) &&
    secretsMatch(internalSecret!, callerSecret!);

  if (!isInternalCall) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = rateLimit(`mcp:${userId}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }
  }

  let body: { tool: string; args: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tool, args } = body ?? {};

  // Whitelist check — never route arbitrary strings to handlers
  if (typeof tool !== "string" || !isMcpTool(tool)) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return NextResponse.json({ error: "Invalid args" }, { status: 400 });
  }

  try {
    const text = await dispatchMcpTool(tool, args);
    return NextResponse.json({ text });
  } catch (err) {
    // Log full detail server-side, but never forward raw upstream error text
    // (which may contain internal hostnames/IPs) to the client.
    console.error(`[mcp/call] ${tool} error:`, err);
    return NextResponse.json({ error: "Tool execution failed" }, { status: 500 });
  }
}
