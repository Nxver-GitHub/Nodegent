import {
  GraduationCap,
  Coffee,
  HeartStraight,
  Laptop,
  Books,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";
import { CalculatorIllustration } from "./CalculatorIllustration";
import { RevealOnScroll } from "./RevealOnScroll";

const CALLOUTS = [
  {
    icon: <Laptop size={22} weight="fill" />,
    color: "bg-[#1D1D1D] text-white",
    title: "Tested in real lectures",
    description:
      "Every panel was prototyped while we were sitting in the same lectures, juggling the same deadlines.",
  },
  {
    icon: <Books size={22} weight="fill" />,
    color: "bg-[#CD8407] text-white",
    title: "Built around your data",
    description:
      "Bring your own LLM key. Your assignments, calendar, and chat live in your Convex — not behind a paywall.",
  },
  {
    icon: <HeartStraight size={22} weight="fill" />,
    color: "bg-[#F34D52] text-white",
    title: "Free for students",
    description:
      "Forever. We pay for the platform; you pay for your own coffee. (We highly recommend the coffee.)",
  },
];

export function BuiltByStudents() {
  return (
    <section className="relative w-full overflow-hidden px-6 py-20">
      {/* Soft notebook-paper backdrop accents */}
      <div
        className="pointer-events-none absolute inset-0 bg-[#FFFCEF]/65"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        {/* Left — "open notebook" card with the team story */}
        <RevealOnScroll direction="left">
        <div className="relative flex flex-col">
          {/* Floating handwritten sticky note */}
          <div
            className="sticky sticky-mint font-hand absolute -top-8 -right-4 z-20 rotate-[6deg] text-center text-gray-900"
            aria-hidden="true"
          >
            <p className="text-[20px] leading-tight">made with ☕ + chaos</p>
            <p className="text-[15px] text-gray-700">— the Nodegent team</p>
          </div>

          <div className="brutal-border-lg relative rounded-lg bg-white">
            {/* Notebook spiral binding */}
            <div className="absolute -left-2 top-0 flex h-full flex-col items-center justify-around py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <span
                  key={i}
                  className="block h-2 w-4 rounded-full border border-gray-700 bg-white"
                  aria-hidden="true"
                />
              ))}
            </div>

            <div className="px-8 py-10 pl-12">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#CD8407]">
                <GraduationCap size={14} weight="fill" />
                The team
              </div>
              <h3 className="text-balance text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Built by students who actually use it.
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-gray-800">
                Nodegent comes from a small team of UCSC students who got tired
                of bouncing between five tabs to figure out what was due. We’re
                building the tool we always wished we had — grounded in real
                campus data, with an audit trail that respects what an AI is
                allowed to do on your behalf.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-[12px] font-semibold text-gray-700">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1">
                  <MapPin size={12} weight="fill" className="text-[#F34D52]" />
                  Santa Cruz, CA
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1">
                  <Coffee size={12} weight="fill" className="text-[#8B5E3C]" />
                  Cups of coffee: 412
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1">
                  <GraduationCap size={12} weight="fill" className="text-[#1D1D1D]" />
                  CSE 115A · Spring 2026
                </span>
              </div>
            </div>
          </div>

          {/* TI-84 CE calculator — in normal flow below the notebook, tilted like it’s sitting on a desk */}
          <div
            className="drift pointer-events-none ml-3 mt-4 hidden self-start lg:block"
            style={{ ['--rot' as string]: '-6deg', transform: 'rotate(-6deg)' } as React.CSSProperties}
            aria-hidden="true"
          >
            <CalculatorIllustration />
          </div>
        </div>
        </RevealOnScroll>

        {/* Right — callouts */}
        <div className="flex flex-col gap-4">
          <RevealOnScroll>
            <div className="flex items-center gap-3">
              <p className="inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800">
                Why students stay
              </p>
            </div>
          </RevealOnScroll>
          {CALLOUTS.map((c, i) => (
            <RevealOnScroll key={c.title} delay={i * 0.1}>
            <div
              className="brutal-border-lg flex items-start gap-4 rounded-lg bg-white p-5"
            >
              <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md ${c.color}`}
              >
                {c.icon}
              </div>
              <div>
                <h4 className="text-lg font-extrabold tracking-tight text-gray-900">
                  {c.title}
                </h4>
                <p className="mt-1 text-[14px] leading-relaxed text-gray-800">
                  {c.description}
                </p>
              </div>
            </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
