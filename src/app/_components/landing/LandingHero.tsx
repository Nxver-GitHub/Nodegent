import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { DashboardMockup } from "./DashboardMockup";
import { MacBookFrame } from "./MacBookFrame";
import { TextbookStack } from "./TextbookStack";

export function LandingHero() {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
        {/* Left column — copy */}
        <div className="relative z-10 flex flex-col items-start text-left">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/90 px-4 py-1.5 text-[12px] font-semibold text-gray-800 shadow-sm backdrop-blur">
            <Sparkle size={14} weight="fill" className="pulse-soft text-[#CD8407]" />
            A campus-aware AI assistant for university students
          </div>

          <h1 className="text-balance text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            Your campus,
            <br />
            on{" "}
            <span className="relative inline-block">
              <span className="relative z-10">one desktop</span>
              <span
                className="absolute bottom-1 left-0 -z-0 h-3 w-full bg-[#EB9D2A]/60 sm:h-4"
                aria-hidden="true"
              />
            </span>
            .
          </h1>

          <div className="brutal-border mt-6 inline-block max-w-xl rounded-md bg-white px-5 py-4">
            <p className="text-pretty text-base text-gray-800 sm:text-lg">
              Nodegent unifies <span className="font-bold text-gray-900">Canvas</span>,{" "}
              <span className="font-bold text-gray-900">your campus portal</span>, and{" "}
              <span className="font-bold text-gray-900">Google Calendar</span> behind a single
              OS-style dashboard — with an AI assistant that already knows your courses,
              assignments, and deadlines.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/sign-up"
              className="brutal-border-lg inline-flex items-center gap-2 rounded-md bg-[#1D1D1D] px-6 py-3 text-sm font-bold text-white hover:bg-black"
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

          <div className="brutal-border mt-5 inline-flex w-fit max-w-full flex-wrap items-center gap-x-5 gap-y-1 rounded-md bg-white px-4 py-2.5 text-[12px] font-medium text-gray-800">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7CC36E]" />
              Free for students
            </span>
            <span aria-hidden="true" className="text-gray-400">|</span>
            <span>Bring your own LLM API key</span>
            <span aria-hidden="true" className="text-gray-400">|</span>
            <span>No credit card required</span>
          </div>

        </div>

        {/* Right column — MacBook + textbooks as desk scene */}
        <div className="relative z-10 flex w-full items-end justify-center gap-5 lg:justify-end">
          {/* Textbooks stacked on the desk beside the laptop */}
          <div className="hidden shrink-0 pb-5 lg:block">
            <TextbookStack className="w-40" />
          </div>
          <div className="relative w-full max-w-xl lg:max-w-[480px]">
            <div className="float-slow">
              <MacBookFrame>
                <DashboardMockup />
              </MacBookFrame>
            </div>

            {/* Sticky note nudges — properly tape-pinned, vivid Post-it paper */}
            <div
              className="sticky sticky-yellow font-hand absolute -bottom-2 -left-2 z-20 hidden rotate-[-7deg] text-center text-gray-900 sm:block lg:-bottom-6 lg:-left-12"
              aria-hidden="true"
            >
              <p className="text-[20px] leading-tight">click the tabs!</p>
              <p className="text-[15px] text-gray-700">try every view →</p>
            </div>
            <div
              className="sticky sticky-pink font-hand absolute -top-4 -right-1 z-20 hidden rotate-[8deg] text-center text-gray-900 md:block lg:-top-6 lg:-right-8"
              aria-hidden="true"
            >
              <p className="text-[18px] leading-tight">✨ it auto-cycles too</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
