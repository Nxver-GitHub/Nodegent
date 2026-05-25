import Link from "next/link";
import { Graph } from "@phosphor-icons/react/dist/ssr";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-300 bg-[#EEEFE9]/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-gray-900 text-white">
            <Graph size={16} weight="bold" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-gray-900">
            Nodegent
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-[13px] font-semibold">
          <Link
            href="/sign-in"
            className="hidden text-[#4D4F46] hover:text-black hover:underline underline-offset-4 sm:inline"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="brutal-border rounded-md bg-[#1D1D1D] px-3 py-1.5 text-white hover:bg-black"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
