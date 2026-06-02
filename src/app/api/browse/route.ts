import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAllowedUrl } from "@/lib/browse-allowlist";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, query, userAllowedDomains } = body as {
    url?: string; query?: string; userAllowedDomains?: string[];
  };

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!isAllowedUrl(url, userAllowedDomains ?? [])) {
    return NextResponse.json({ error: "URL not in allowlist" }, { status: 403 });
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
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
