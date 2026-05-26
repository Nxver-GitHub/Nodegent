"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen } from "@phosphor-icons/react";
import { RevealOnScroll } from "./RevealOnScroll";

const FAQS = [
  {
    chapter: "Ch. 1",
    topic: "Authentication",
    q: "Is my Canvas password stored anywhere?",
    a: "Never. Nodegent uses your browser session cookies after you authenticate — your password is only used to complete the login and is never written to disk or stored on our servers. Once the session expires, you simply re-authenticate.",
  },
  {
    chapter: "Ch. 2",
    topic: "AI & Billing",
    q: "Do I need to pay for an AI subscription?",
    a: "Nodegent uses your own OpenAI or Anthropic API key, so you control the spend directly. Keys are stored encrypted server-side and are never exposed to the browser or shared with anyone.",
  },
  {
    chapter: "Ch. 3",
    topic: "University & Policy",
    q: "Does Nodegent have official university approval?",
    a: "Nodegent is a student-built capstone project for CSE 115A at UCSC. It reads only what you explicitly authorize via OAuth and Canvas session access. No data is shared with the university or any third party.",
  },
  {
    chapter: "Ch. 4",
    topic: "Permissions",
    q: "Can Nodegent submit assignments or change anything on Canvas?",
    a: "No — Nodegent is strictly read-only. It fetches your courses, assignments, grades, and deadlines. It cannot post, submit, or modify anything on your behalf, and all agent actions are logged so you can see exactly what was read.",
  },
  {
    chapter: "Ch. 5",
    topic: "Data & Storage",
    q: "Where is my campus data stored?",
    a: "Your data lives in Convex, a serverless database tied only to your account. Nothing is stored on shared infrastructure or third-party analytics services. You can revoke all access and delete your data at any time from the dashboard settings.",
  },
  {
    chapter: "Ch. 6",
    topic: "Account Deletion",
    q: "What happens to my data if I stop using Nodegent?",
    a: "You can delete your account at any time from the settings page. All stored data — Canvas session cookies, assignments, calendar events, and chat history — is permanently and immediately erased.",
  },
];

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export function FAQ() {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);

  const go = (delta: number) => {
    const next = Math.max(0, Math.min(FAQS.length - 1, page + delta));
    if (next === page) return;
    setDir(delta);
    setPage(next);
  };

  const goTo = (i: number) => {
    if (i === page) return;
    setDir(i > page ? 1 : -1);
    setPage(i);
  };

  const faq = FAQS[page];

  return (
    <section id="faq" className="w-full border-t border-black/10 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <RevealOnScroll>
          <div className="mb-12">
            <p className="mb-3 inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800">
              FAQ
            </p>
            <h2 className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Questions students actually ask.
            </h2>
            <div className="brutal-border mt-5 inline-block max-w-2xl rounded-md bg-white px-5 py-4">
              <p className="text-[15px] leading-relaxed text-gray-800">
                Flip through honest answers about data, privacy, and how Nodegent actually works.
              </p>
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          {/* Book container */}
          <div className="brutal-border-lg flex overflow-hidden rounded-lg">
            {/* Spine */}
            <div className="flex w-10 flex-none flex-col items-center justify-between border-r border-[#1D1D1D] bg-[#1D1D1D] py-5">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Nodegent
              </span>
              <span className="text-[9px] font-mono font-bold text-white/30">
                FAQ
              </span>
            </div>

            {/* Page area */}
            <div className="flex flex-1 flex-col bg-white">
              {/* Chapter header */}
              <div className="flex items-center justify-between border-b border-gray-200 bg-[#FDFAF4] px-6 py-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} weight="bold" className="text-[#CD8407]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#CD8407]">
                    {faq.chapter} — {faq.topic}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-gray-400">
                  {page + 1} / {FAQS.length}
                </span>
              </div>

              {/* Lined page body */}
              <div
                className="relative min-h-[220px] flex-1 overflow-hidden px-8 py-6"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(transparent, transparent 27px, #E8E8E8 27px, #E8E8E8 28px)",
                  backgroundPosition: "0 38px",
                }}
              >
                {/* Red margin line */}
                <div
                  className="absolute bottom-0 left-[3.25rem] top-0 w-px bg-red-200"
                  aria-hidden="true"
                />

                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div
                    key={page}
                    custom={dir}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="relative pl-5"
                  >
                    <h3 className="mb-5 text-xl font-extrabold leading-snug text-gray-900 sm:text-2xl">
                      {faq.q}
                    </h3>
                    <p className="text-[15px] leading-[28px] text-[#4D4F46]">
                      {faq.a}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation footer */}
              <div className="flex items-center justify-between border-t border-gray-200 bg-[#FDFAF4] px-6 py-3">
                <button
                  onClick={() => go(-1)}
                  disabled={page === 0}
                  className="brutal-border flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowLeft size={14} weight="bold" />
                  Prev
                </button>

                {/* Dot trail */}
                <div className="flex items-center gap-1.5">
                  {FAQS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      aria-label={`Jump to question ${i + 1}`}
                      className={`h-2 rounded-full transition-all duration-200 ${
                        i === page
                          ? "w-5 bg-[#1D1D1D]"
                          : "w-2 bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => go(1)}
                  disabled={page === FAQS.length - 1}
                  className="brutal-border flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                  <ArrowRight size={14} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
