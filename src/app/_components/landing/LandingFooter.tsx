import Link from "next/link";
import { GithubLogo, Graph } from "@phosphor-icons/react/dist/ssr";

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-gray-800 bg-[#1D1D1D]">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-8 text-[12px] text-white/60 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-white">
            <Graph size={13} weight="bold" />
          </div>
          <span className="font-extrabold text-white">Nodegent</span>
          <span>· © {year} Built by students, at UCSC</span>
        </div>
        <Link
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 py-2 font-semibold text-white/60 hover:text-white"
        >
          <GithubLogo size={14} weight="bold" />
          GitHub
        </Link>
      </div>
    </footer>
  );
}
