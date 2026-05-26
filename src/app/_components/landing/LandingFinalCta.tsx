import Link from "next/link";
import { ArrowRight, Graph } from "@phosphor-icons/react/dist/ssr";
import { RevealOnScroll } from "./RevealOnScroll";

export function LandingFinalCta() {
  return (
    <section className="w-full px-6 py-24">
      <RevealOnScroll>
      <div className="brutal-border-lg mx-auto max-w-4xl overflow-hidden rounded-lg bg-white">
        {/* Window title bar — reinforces the OS aesthetic */}
        <div className="relative flex h-9 items-center justify-between border-b border-gray-300 bg-[#F6F6F6] px-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#F34D52]" />
            <span className="h-3 w-3 rounded-full bg-[#EB9D2A]" />
            <span className="h-3 w-3 rounded-full bg-[#7CC36E]" />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-[12px] font-bold text-gray-800">
            nodegent.app — sign up
          </span>
          <Graph size={14} className="text-gray-500" />
        </div>

        <div className="px-8 py-14 text-center sm:px-12">
          <h2 className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Stop juggling tabs.
            <br />
            Start your quarter.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#4D4F46]">
            Sign up with your campus account and Nodegent will set up your
            dashboard in minutes.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="brutal-border-lg inline-flex items-center gap-2 rounded-md bg-[#CD8407] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#B57206]"
            >
              Create your dashboard
              <ArrowRight size={14} weight="bold" />
            </Link>
            <Link
              href="/sign-in"
              className="text-sm font-semibold text-[#4D4F46] underline-offset-4 hover:text-black hover:underline"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </div>
      </RevealOnScroll>
    </section>
  );
}
