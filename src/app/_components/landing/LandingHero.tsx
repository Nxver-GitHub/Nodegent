import Link from "next/link";
import { ArrowRight, Graph } from "@phosphor-icons/react/dist/ssr";

export function LandingHero() {
  return (
    <section className="relative w-full">
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/70 px-4 py-1.5 text-[12px] font-semibold text-[#4D4F46] shadow-sm">
          <Graph size={14} weight="bold" className="text-[#CD8407]" />
          A campus-aware AI assistant for university students
        </div>

        <h1 className="text-balance text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
          Your campus,
          <br />
          on one desktop.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-[#4D4F46] sm:text-lg">
          Nodegent unifies Canvas, MyUCSC, and Google Calendar behind a single OS-style
          dashboard — with an AI assistant that already knows your courses, assignments,
          and deadlines.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="brutal-border inline-flex items-center gap-2 rounded-md bg-[#1D1D1D] px-6 py-3 text-sm font-bold text-white hover:bg-black"
          >
            Get Started
            <ArrowRight size={14} weight="bold" />
          </Link>
          <Link
            href="/sign-in"
            className="brutal-border inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-bold text-[#1D1D1D] hover:bg-[#F6F6F6]"
          >
            Sign In
          </Link>
        </div>

        <p className="mt-4 text-[12px] text-[#6B6D63]">
          Free for students. Bring your own LLM API key.
        </p>
      </div>
    </section>
  );
}
