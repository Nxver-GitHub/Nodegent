"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";

export function LandingFinalCta() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section className="w-full bg-[#1A1A14] px-6 py-24">
      <div className="mx-auto max-w-5xl text-center">
        {/* Eyebrow */}
        <p className="mb-10 text-[11px] font-bold uppercase tracking-widest text-[#CD8407]/70">
          Your academic journey starts here
        </p>

        {/* Door scene */}
        <div
          ref={ref}
          className="relative mx-auto"
          style={{ maxWidth: 560, height: 400, perspective: "1400px" }}
        >
          {/* CTA content — visible through the opening doors */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-t-[56px] bg-[#0D0D09] px-8">
            <div
              className="pointer-events-none absolute inset-0 rounded-t-[56px]"
              style={{
                background:
                  "radial-gradient(ellipse 65% 50% at 50% 65%, rgba(205,132,7,0.18) 0%, transparent 70%)",
              }}
            />
            <h2 className="relative text-balance text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Stop juggling tabs.
              <br />
              <span className="text-[#CD8407]">Start your quarter.</span>
            </h2>
            <p className="relative max-w-sm text-[14px] leading-relaxed text-gray-400">
              Sign up with your campus account and Nodegent will set up your
              dashboard in minutes.
            </p>
            <div className="relative flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-md bg-[#CD8407] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#B57206]"
                style={{ boxShadow: "0 0 24px rgba(205,132,7,0.35)" }}
              >
                Create your dashboard
                <ArrowRight size={14} weight="bold" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center py-2 text-[13px] font-semibold text-gray-500 underline-offset-4 hover:text-gray-300 hover:underline"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* Stone doorway frame overlay */}
          <div
            className="pointer-events-none absolute inset-0 rounded-t-[56px]"
            style={{
              border: "6px solid #2A2015",
              boxShadow: "inset 0 0 0 4px #3D3020",
            }}
          />

          {/* Left door */}
          <motion.div
            className="absolute left-0 top-0 h-full w-1/2 overflow-hidden rounded-tl-[50px]"
            style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
            initial={{ rotateY: 0 }}
            animate={inView ? { rotateY: -82 } : { rotateY: 0 }}
            transition={{ duration: 1.5, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div
              className="relative h-full w-full"
              style={{
                background: "linear-gradient(135deg, #3D2409 0%, #2C1A0E 50%, #221408 100%)",
              }}
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(180deg, transparent, transparent 9px, rgba(255,255,255,0.04) 9px, rgba(255,255,255,0.04) 10px)",
                }}
              />
              <div className="absolute left-5 right-5 top-8 h-36 rounded-t-[32px] rounded-b border border-[#5A3515]/50 bg-[#1E3A52]/15" />
              <div className="absolute bottom-14 left-5 right-5 h-20 rounded border border-[#5A3515]/50" />
              <div className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-[#8B6914] bg-[#CD8407] shadow-md" />
              <div className="absolute right-0 top-0 h-full w-[3px] bg-[#1A0F08]" />
            </div>
          </motion.div>

          {/* Right door */}
          <motion.div
            className="absolute right-0 top-0 h-full w-1/2 overflow-hidden rounded-tr-[50px]"
            style={{ transformOrigin: "right center", transformStyle: "preserve-3d" }}
            initial={{ rotateY: 0 }}
            animate={inView ? { rotateY: 82 } : { rotateY: 0 }}
            transition={{ duration: 1.5, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div
              className="relative h-full w-full"
              style={{
                background: "linear-gradient(225deg, #3D2409 0%, #2C1A0E 50%, #221408 100%)",
              }}
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(180deg, transparent, transparent 9px, rgba(255,255,255,0.04) 9px, rgba(255,255,255,0.04) 10px)",
                }}
              />
              <div className="absolute left-5 right-5 top-8 h-36 rounded-t-[32px] rounded-b border border-[#5A3515]/50 bg-[#1E3A52]/15" />
              <div className="absolute bottom-14 left-5 right-5 h-20 rounded border border-[#5A3515]/50" />
              <div className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-[#8B6914] bg-[#CD8407] shadow-md" />
              <div className="absolute left-0 top-0 h-full w-[3px] bg-[#1A0F08]" />
            </div>
          </motion.div>
        </div>

        {/* Trust badges below the door */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 1.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-gray-600"
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7CC36E]" />
            Free for students
          </span>
          <span aria-hidden="true">·</span>
          <span>Bring your own LLM key</span>
          <span aria-hidden="true">·</span>
          <span>No credit card required</span>
        </motion.div>
      </div>
    </section>
  );
}
