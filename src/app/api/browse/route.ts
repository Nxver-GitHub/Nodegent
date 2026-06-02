import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAllowedUrl, isPrivateHost } from "@/lib/browse-allowlist";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, query } = body as { url?: string; query?: string };

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!isAllowedUrl(url)) {
    return NextResponse.json({ error: "URL not in allowlist" }, { status: 403 });
  }

  // Abort any redirect that would leave the allowlist or reach a private host.
  const guardRedirect = (target: string): boolean => {
    try {
      const t = new URL(target);
      if (isPrivateHost(t.hostname)) return false;
      return isAllowedUrl(target);
    } catch {
      return false;
    }
  };

  void query; // reserved for future semantic search over page text

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Intercept every request/redirect and abort if outside the allowlist.
    await page.route("**/*", (route) => {
      const reqUrl = route.request().url();
      if (!guardRedirect(reqUrl)) {
        route.abort("blockedbyclient").catch(() => undefined);
      } else {
        route.continue().catch(() => undefined);
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    const text = await page.evaluate(() => document.body.innerText);
    await browser.close();
    const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 3000);
    return NextResponse.json({ text: trimmed, url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Browse failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
