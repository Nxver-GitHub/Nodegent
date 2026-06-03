export const STATIC_ALLOWLIST = [
  "santacruz-sidekick.vercel.app",
  "cabalex.github.io",
  "slugsurvival.com",
  "dining.ucsc.edu",
  "maps.ucsc.edu",
  "pisa.ucsc.edu",
];

// Matches private/loopback/link-local IPv4 and IPv6 ranges.
const PRIVATE_IP_RE =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0$|::1$|localhost$)/i;

export function isPrivateHost(host: string): boolean {
  return PRIVATE_IP_RE.test(host);
}

export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return false;
    if (isPrivateHost(host)) return false;
    return STATIC_ALLOWLIST.some(
      (allowed) => host === allowed || host.endsWith("." + allowed)
    );
  } catch {
    return false;
  }
}
