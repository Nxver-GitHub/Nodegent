export const STATIC_ALLOWLIST = [
  "santacruz-sidekick.vercel.app",
  "cabalex.github.io",
  "slugsurvival.com",
  "dining.ucsc.edu",
  "maps.ucsc.edu",
];

export function isAllowedUrl(url: string, userAllowedDomains: string[] = []): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return false;
    return [...STATIC_ALLOWLIST, ...userAllowedDomains].some(
      (allowed) => host === allowed || host.endsWith("." + allowed)
    );
  } catch {
    return false;
  }
}
