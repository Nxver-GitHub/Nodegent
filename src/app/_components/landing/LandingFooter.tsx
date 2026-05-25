import Link from "next/link";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-gray-300 bg-[#EEEFE9]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-[12px] text-[#4D4F46] sm:flex-row">
        <p>
          © {year} Nodegent. Built for students at UCSC.
        </p>
        <Link
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold hover:text-black"
        >
          <GithubLogo size={14} weight="bold" />
          GitHub
        </Link>
      </div>
    </footer>
  );
}
