import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy",
  "/tos",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/.well-known(.*)",
]);

const isApiRoute = createRouteMatcher(["/api(.*)"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense in depth: browsers attach Origin to every cross-origin
 * state-changing request, so reject API writes whose Origin isn't this site.
 * Requests with no Origin (server-to-server, e.g. Convex → /api/browse) pass
 * through to the route's own auth. Clerk's SameSite=Lax session cookie is the
 * primary protection; this closes the gap for same-site-but-foreign origins.
 */
function isForeignOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(req.url).host;
  } catch {
    return true;
  }
}

export default clerkMiddleware(
  async (auth, req) => {
    if (isApiRoute(req) && !SAFE_METHODS.has(req.method) && isForeignOrigin(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  {
    // Strict CSP: per-request nonce + 'strict-dynamic', so injected inline
    // scripts can't run ('unsafe-inline' is ignored by browsers once a nonce
    // is present). Clerk supplies its own and Turnstile's hosts; these are ours.
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "img-src": ["data:", "blob:", "https://res.cloudinary.com"],
        "font-src": ["self"],
        "connect-src": [
          "https://*.convex.cloud",
          "wss://*.convex.cloud",
          "https://*.clerk.accounts.dev",
          "https://clerk.accounts.dev",
          "https://clerk.nodegent.app",
          "https://accounts.nodegent.app",
          "https://*.instructure.com",
          "https://pisa.ucsc.edu",
        ],
        "frame-src": [
          "https://clerk.accounts.dev",
          "https://*.clerk.accounts.dev",
          "https://clerk.nodegent.app",
          "https://accounts.nodegent.app",
          "https://cabalex.github.io",
          "https://santacruz-sidekick.vercel.app",
        ],
        "frame-ancestors": ["none"],
        "object-src": ["none"],
        "base-uri": ["self"],
      },
    },
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
