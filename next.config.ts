import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Content-Security-Policy is set per request by clerkMiddleware (strict,
  // nonce-based) in src/middleware.ts — a second CSP here would intersect it.
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/playwright-core/**",
      "./node_modules/@sparticuz/chromium/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
