"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { RevealOnScroll } from "./RevealOnScroll";

export function LandingFinalCta() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section className="relative w-full px-6 py-24">
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <RevealOnScroll>
          <div className="mb-12 text-center">
            <p className="mb-4 inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800">
              Ready to start?
            </p>
            <h2 className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Open the door to a calmer quarter.
            </h2>
          </div>
        </RevealOnScroll>

        {/* Door scene */}
        <div
          ref={ref}
          className="relative mx-auto"
          style={{ maxWidth: 640, perspective: "1800px" }}
        >
          <div className="relative" style={{ height: 520 }}>
            {/* Welcome card — revealed when doors swing open */}
            <div className="absolute inset-x-0 top-8 bottom-6 flex items-center justify-center px-10">
              <div className="brutal-border-lg w-full max-w-sm rounded-lg bg-white px-8 py-10 text-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#CD8407]">
                  Welcome Notice
                </p>
                <h3 className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">
                  Stop juggling tabs.
                  <br />
                  Start your quarter.
                </h3>
                <p className="mb-6 text-[13px] leading-relaxed text-[#4D4F46]">
                  Sign up with your campus account. Setup takes about a minute.
                </p>
                <Link
                  href="/sign-up"
                  className="brutal-border-lg inline-flex items-center gap-2 rounded-md bg-[#CD8407] px-6 py-3 text-sm font-bold text-white hover:bg-[#B57206]"
                >
                  Create your dashboard
                  <ArrowRight size={14} weight="bold" />
                </Link>
                <p className="mt-4 text-[12px] text-gray-500">
                  Already have an account?{" "}
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center py-1 font-semibold text-gray-700 underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>

            {/* Wood door frame trim */}
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 rounded-t-[40px]"
              style={{
                height: 510,
                border: "10px solid #6B4423",
                borderBottom: "none",
                boxShadow: "inset 0 0 0 3px #4A2E1A",
              }}
            />

            {/* Threshold / hardwood floor strip */}
            <div
              className="absolute bottom-0 left-0 right-0 h-4"
              style={{
                background:
                  "linear-gradient(180deg, #6B4423 0%, #4A2E1A 100%)",
                borderTop: "1px solid #2A1A0C",
              }}
            />

            {/* Left door */}
            <motion.div
              className="absolute left-0 top-0 w-1/2 overflow-hidden rounded-tl-[32px]"
              style={{
                height: 506,
                transformOrigin: "left center",
                transformStyle: "preserve-3d",
              }}
              initial={{ rotateY: 0 }}
              animate={inView ? { rotateY: -86 } : { rotateY: 0 }}
              transition={{
                duration: 1.6,
                delay: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <div
                className="relative h-full w-full"
                style={{ backgroundColor: "#C9A875" }}
              >
                {/* Wood grain */}
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(180deg, transparent, transparent 7px, rgba(0,0,0,0.07) 7px, rgba(0,0,0,0.07) 8px)",
                  }}
                />
                {/* Frosted glass panel */}
                <div
                  className="absolute left-5 right-3 top-8 flex items-center justify-end rounded-t-[28px] rounded-b border-2 pr-3"
                  style={{
                    height: 168,
                    backgroundColor: "#E8E4D8",
                    borderColor: "#8B6914",
                    boxShadow: "inset 0 0 12px rgba(0,0,0,0.06)",
                  }}
                >
                  <span className="text-[12px] font-extrabold tracking-[0.28em] text-[#8B6914]">
                    NODE
                  </span>
                </div>
                {/* Bottom recessed panel */}
                <div
                  className="absolute bottom-12 left-5 right-3 rounded border-2"
                  style={{
                    height: 180,
                    backgroundColor: "#B89765",
                    borderColor: "#8B6914",
                  }}
                />
                {/* Brass knob */}
                <div
                  className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-[#8B6914] shadow-md"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 35%, #F2C040, #CD8407 60%, #8B6914)",
                  }}
                />
                {/* Center seam */}
                <div
                  className="absolute right-0 top-0 h-full w-[3px]"
                  style={{ backgroundColor: "#4A2E1A" }}
                />
              </div>
            </motion.div>

            {/* Right door */}
            <motion.div
              className="absolute right-0 top-0 w-1/2 overflow-hidden rounded-tr-[32px]"
              style={{
                height: 506,
                transformOrigin: "right center",
                transformStyle: "preserve-3d",
              }}
              initial={{ rotateY: 0 }}
              animate={inView ? { rotateY: 86 } : { rotateY: 0 }}
              transition={{
                duration: 1.6,
                delay: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <div
                className="relative h-full w-full"
                style={{ backgroundColor: "#C9A875" }}
              >
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(180deg, transparent, transparent 7px, rgba(0,0,0,0.07) 7px, rgba(0,0,0,0.07) 8px)",
                  }}
                />
                <div
                  className="absolute left-3 right-5 top-8 flex items-center justify-start rounded-t-[28px] rounded-b border-2 pl-3"
                  style={{
                    height: 168,
                    backgroundColor: "#E8E4D8",
                    borderColor: "#8B6914",
                    boxShadow: "inset 0 0 12px rgba(0,0,0,0.06)",
                  }}
                >
                  <span className="text-[12px] font-extrabold tracking-[0.28em] text-[#8B6914]">
                    GENT
                  </span>
                </div>
                <div
                  className="absolute bottom-12 left-3 right-5 rounded border-2"
                  style={{
                    height: 180,
                    backgroundColor: "#B89765",
                    borderColor: "#8B6914",
                  }}
                />
                <div
                  className="absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-[#8B6914] shadow-md"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 35%, #F2C040, #CD8407 60%, #8B6914)",
                  }}
                />
                <div
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{ backgroundColor: "#4A2E1A" }}
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 1.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-medium text-gray-700"
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7CC36E]" />
            Free for students
          </span>
          <span aria-hidden="true" className="text-gray-400">
            ·
          </span>
          <span>Bring your own LLM key</span>
          <span aria-hidden="true" className="text-gray-400">
            ·
          </span>
          <span>No credit card required</span>
        </motion.div>
      </div>
    </section>
  );
}
