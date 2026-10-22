import { describe, expect, it } from "vitest";
import { isSafeChatLink } from "../chat-link-allowlist";

describe("isSafeChatLink", () => {
  it("allows https links to UCSC and known campus tools", () => {
    expect(isSafeChatLink("https://canvas.ucsc.edu/courses/1")).toBe(true);
    expect(isSafeChatLink("https://ucsc.edu/")).toBe(true);
    expect(isSafeChatLink("https://nutrition.sa.ucsc.edu/shortmenu.aspx?x=1")).toBe(true);
    expect(isSafeChatLink("https://santacruz-sidekick.vercel.app/")).toBe(true);
    expect(isSafeChatLink("https://cabalex.github.io/slugschedule")).toBe(true);
  });

  it("allows mailto only for ucsc.edu addresses", () => {
    expect(isSafeChatLink("mailto:prof@ucsc.edu")).toBe(true);
    expect(isSafeChatLink("mailto:a@evil.example?body=secret")).toBe(false);
    expect(isSafeChatLink("mailto:a@evil.example,prof@ucsc.edu")).toBe(false);
  });

  it("blocks other hosts, lookalikes, and non-https schemes", () => {
    expect(isSafeChatLink("https://evil.example/?d=assignments")).toBe(false);
    expect(isSafeChatLink("https://ucsc.edu.evil.example/")).toBe(false);
    expect(isSafeChatLink("https://evilucsc.edu/")).toBe(false);
    expect(isSafeChatLink("http://canvas.ucsc.edu/")).toBe(false);
    expect(isSafeChatLink("javascript:alert(1)")).toBe(false);
    expect(isSafeChatLink("/relative")).toBe(false);
    expect(isSafeChatLink(undefined)).toBe(false);
  });
});
