import { RevealOnScroll } from "./RevealOnScroll";

export function BeforeAfter() {
  return (
    <section className="relative w-full px-6 py-20">
      <div className="pointer-events-none absolute inset-0 bg-white/30" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl">
        {/* Heading */}
        <RevealOnScroll>
          <div className="mb-14 max-w-3xl">
            <p className="mb-3 inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800">
              The Problem
            </p>
            <h2 className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Five apps just to see what&apos;s due.
            </h2>
            <div className="brutal-border mt-5 inline-block max-w-2xl rounded-md bg-white px-5 py-4">
              <p className="text-[15px] leading-relaxed text-gray-800">
                Canvas for assignments. Gmail for professor updates. Gradescope
                for submissions. Google Calendar manually updated. Piazza for
                announcements. Nodegent replaces all of it.
              </p>
            </div>
          </div>
        </RevealOnScroll>

        {/* Comparison panels */}
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_72px_1fr]">
          {/* BEFORE panel */}
          <RevealOnScroll direction="left">
            <div className="relative">
              {/* Ghost windows behind — suggest tab chaos */}
              <div
                className="absolute inset-0 -z-10 translate-x-3 translate-y-3 rotate-[1.5deg] rounded-lg border border-gray-200 bg-gray-100/90"
                aria-hidden="true"
              />
              <div
                className="absolute inset-0 -z-20 translate-x-6 translate-y-6 rotate-[3deg] rounded-lg border border-gray-200 bg-gray-200/70"
                aria-hidden="true"
              />

              {/* Main browser window */}
              <div className="brutal-border-lg relative overflow-hidden rounded-lg bg-white">
                {/* Browser chrome */}
                <div className="border-b border-gray-200 bg-[#EBEBEB] px-3 pt-2">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#F34D52]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#EB9D2A]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#7CC36E]" />
                  </div>
                  {/* Tab bar */}
                  <div className="flex items-end gap-0.5 overflow-hidden">
                    <div className="flex items-center gap-1.5 rounded-t-md border border-b-0 border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-800">
                      Canvas
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#F34D52] text-[9px] font-bold text-white">
                        14
                      </span>
                    </div>
                    <div className="rounded-t-md px-2.5 py-1.5 text-[11px] text-gray-500">Gmail</div>
                    <div className="rounded-t-md px-2.5 py-1.5 text-[11px] text-gray-500">Gscope</div>
                    <div className="hidden rounded-t-md px-2.5 py-1.5 text-[11px] text-gray-500 sm:block">GCal</div>
                    <div className="rounded-t-md px-2 py-1.5 text-[11px] font-semibold text-gray-400">+3</div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="mb-3 text-[13px] font-bold text-gray-800">Assignments — CSE 115A</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2">
                      <span className="mt-0.5 text-[11px] font-bold text-red-500">⚠</span>
                      <div>
                        <p className="text-[12px] font-semibold text-gray-900">HW 3 — due TONIGHT 11:59 PM</p>
                        <p className="text-[10px] text-gray-500">Submit via Gradescope (check email for link)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-2">
                      <span className="mt-0.5 text-[11px] text-gray-400">?</span>
                      <div>
                        <p className="text-[12px] font-semibold text-gray-800">Lab Report — when is this due?</p>
                        <p className="text-[10px] text-gray-500">Check Piazza for the updated deadline</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-2">
                      <span className="mt-0.5 text-[11px] text-gray-400">?</span>
                      <div>
                        <p className="text-[12px] font-semibold text-gray-800">Quiz 4 — Friday or Thursday??</p>
                        <p className="text-[10px] text-gray-500">Professor&apos;s slide said &quot;see Canvas announcement&quot;</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] italic text-gray-400">
                    Also check Gmail · Gradescope · Piazza · Google Calendar…
                  </p>
                </div>
              </div>

              {/* Caption */}
              <div className="brutal-border mt-4 rounded-md bg-white px-4 py-2.5 text-center">
                <p className="text-[14px] font-semibold text-gray-700">
                  5 apps · 14 notifications · still not sure what&apos;s due
                </p>
              </div>
            </div>
          </RevealOnScroll>

          {/* Center arrow */}
          <RevealOnScroll delay={0.15} className="flex flex-col items-center justify-center gap-3">
            <div className="hidden h-16 w-px bg-gray-300 lg:block" aria-hidden="true" />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D1D1D] text-base font-bold text-white shadow-md">
              →
            </div>
            <div className="brutal-border rounded-md bg-white px-3 py-1.5 text-center">
              <p className="text-[12px] font-bold uppercase tracking-wider text-gray-800">
                with<br />Nodegent
              </p>
            </div>
            <div className="hidden h-16 w-px bg-gray-300 lg:block" aria-hidden="true" />
          </RevealOnScroll>

          {/* AFTER panel */}
          <RevealOnScroll direction="right" delay={0.05}>
            <div>
              <div className="brutal-border-lg overflow-hidden rounded-lg bg-white">
                {/* OS title bar */}
                <div className="relative flex h-9 items-center justify-between border-b border-gray-300 bg-[#F6F6F6] px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#F34D52]" />
                    <span className="h-3 w-3 rounded-full bg-[#EB9D2A]" />
                    <span className="h-3 w-3 rounded-full bg-[#7CC36E]" />
                  </div>
                  <span className="absolute left-1/2 -translate-x-1/2 text-[12px] font-bold text-gray-800">
                    nodegent — Dashboard
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[13px] font-bold text-gray-900">Today&apos;s Focus</p>
                    <span className="text-[11px] font-semibold text-[#CD8407">⚡ 3 urgent</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-red-100 bg-[#FFF5F5] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#F34D52]" />
                        <span className="text-[12px] font-semibold text-gray-900">HW 3</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-[#F34D52]">Tonight 11:59 PM</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-amber-100 bg-[#FFFBF0] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#CD8407]" />
                        <span className="text-[12px] font-semibold text-gray-800">Lab Report</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-[#CD8407]">Fri 5:00 PM</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                        <span className="text-[12px] text-gray-500">Final Project</span>
                      </div>
                      <span className="font-mono text-[11px] text-gray-400">Dec 12</span>
                    </div>
                  </div>

                  {/* AI assistant bubble */}
                  <div className="mt-3 rounded-md bg-[#1D1D1D] px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-white/90">
                      <span className="mr-1.5 font-bold text-[#CD8407]">AI</span>
                      &ldquo;Focus on HW 3 first. Lab Report is Friday at 5. Quiz 4 is Thursday.”
                    </p>
                  </div>
                </div>
              </div>

              {/* Caption */}
              <div className="brutal-border mt-4 rounded-md bg-white px-4 py-2.5 text-center">
                <p className="text-[14px] font-semibold text-gray-700">
                  One dashboard · everything synced · AI knows your schedule
                </p>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
