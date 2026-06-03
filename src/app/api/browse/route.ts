import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAllowedUrl, isPrivateHost } from "@/lib/browse-allowlist";
import type { Page } from "playwright";

export const maxDuration = 30;

// Pisa needs form-fill + AJAX submit — plain goto returns an empty shell.
async function browsePisa(page: Page, params: URLSearchParams): Promise<string> {
  await page.goto("https://pisa.ucsc.edu/class_search/index.php", {
    waitUntil: "networkidle",
    timeout: 20000,
  });

  const term = params.get("binds[:term]") ?? params.get("binds%5B%3Aterm%5D") ?? "2262";
  const subject = params.get("binds[:subject]") ?? params.get("binds%5B%3Asubj%5D") ?? "";
  const regStatus = params.get("binds[:reg_status]") ?? "all";

  await page.evaluate(
    ({ term, subject, regStatus }: { term: string; subject: string; regStatus: string }) => {
      const sel = (name: string) =>
        document.querySelector<HTMLSelectElement | HTMLInputElement>(`[name="${name}"]`);
      const termEl = sel("binds[:term]");
      const subjEl = sel("binds[:subject]");
      const statusEl = sel("binds[:reg_status]");
      if (termEl) termEl.value = term;
      if (subjEl) subjEl.value = subject;
      if (statusEl) statusEl.value = regStatus;
    },
    { term, subject, regStatus }
  );

  await page.evaluate(() => {
    const form = document.getElementById("searchForm") as HTMLFormElement | null;
    form?.submit();
  });

  // Wait up to 15 s for at least one result row to appear
  await page.waitForSelector("[id^=rowpanel]", { timeout: 15000 }).catch(() => null);

  return page.evaluate(() => document.body.innerText);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Accept either a Clerk browser session OR the shared internal secret
  // (used when Convex actions call this endpoint server-to-server).
  const internalSecret = process.env.CONVEX_INTERNAL_SECRET;
  const callerSecret = request.headers.get("x-nodegent-internal");
  const isInternalCall =
    internalSecret && callerSecret && callerSecret === internalSecret;

  if (!isInternalCall) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Private-IP block applies to ALL requests (navigation + subresources) to prevent
    // JS on allowlisted pages from exfiltrating data via fetch/XHR to internal hosts.
    // Allowlist is only enforced on navigation requests so subresource CDNs can load.
    await page.route("**/*", (route) => {
      const reqUrl = route.request().url();
      try {
        const u = new URL(reqUrl);
        if (isPrivateHost(u.hostname)) {
          route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
      } catch {
        route.abort("blockedbyclient").catch(() => undefined);
        return;
      }
      const isNavigation = route.request().isNavigationRequest();
      if (isNavigation && !guardRedirect(reqUrl)) {
        route.abort("blockedbyclient").catch(() => undefined);
      } else {
        route.continue().catch(() => undefined);
      }
    });

    const parsed = new URL(url);
    const rawText =
      parsed.hostname === "pisa.ucsc.edu"
        ? await browsePisa(page, parsed.searchParams)
        : await page
            .goto(url, { waitUntil: "networkidle", timeout: 25000 })
            .then(() => page.evaluate(() => document.body.innerText));
    await browser.close();
    const text = rawText;
    const trimmed = rawText.replace(/\s+/g, " ").trim().slice(0, 3000);
    return NextResponse.json({ text: trimmed, url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Browse failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
