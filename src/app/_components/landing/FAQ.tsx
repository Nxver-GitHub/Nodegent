"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "@phosphor-icons/react";
import { RevealOnScroll } from "./RevealOnScroll";

const FAQS = [
  {
    q: "Is my Canvas password stored anywhere?",
    a: "Never. Nodegent uses your browser session cookies after you authenticate — your password is only used to complete the login and is never written to disk or stored on our servers. Once the session expires, you simply re-authenticate.",
  },
  {
    q: "Do I need to pay for an AI subscription?",
    a: "Nodegent uses your own OpenAI or Anthropic API key, so you control the spend directly. Keys are stored encrypted server-side and are never exposed to the browser or shared with anyone.",
  },
  {
    q: "Does Nodegent have official university approval?",
    a: "Nodegent is a student-built capstone project for CSE 115A at UCSC. It reads only what you explicitly authorize via OAuth and Canvas session access. No data is shared with the university or any third party.",
  },
  {
    q: "Can Nodegent submit assignments or change anything on Canvas?",
    a: "No — Nodegent is strictly read-only. It fetches your courses, assignments, grades, and deadlines. It cannot post, submit, or modify anything on your behalf, and all agent actions are logged so you can see exactly what was read.",
  },
  {
    q: "Where is my campus data stored?",
    a: "Your data lives in Convex, a serverless database tied only to your account. Nothing is stored on shared infrastructure or third-party analytics services. You can revoke all access and delete your data at any time from the dashboard settings.",
  },
  {
    q: "What happens to my data if I stop using Nodegent?",
    a: "You can delete your account at any time from the settings page. All stored data — Canvas session cookies, assignments, calendar events, and chat history — is permanently and immediately erased.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="w-full px-6 py-20">
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
                Honest answers about data, privacy, and how Nodegent actually works.
              </p>
            </div>
          </div>
        </RevealOnScroll>

        <div className="flex flex-col gap-3">
          {FAQS.map((faq, i) => (
            <RevealOnScroll key={i} delay={i * 0.06}>
              <div className="brutal-border-lg overflow-hidden rounded-lg bg-white">
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                >
                  <span className="text-[15px] font-bold text-gray-900">
                    {faq.q}
                  </span>
                  <span className="flex-shrink-0 rounded-md bg-gray-100 p-1">
                    {open === i ? (
                      <Minus size={16} weight="bold" className="text-gray-700" />
                    ) : (
                      <Plus size={16} weight="bold" className="text-gray-700" />
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-200 px-6 py-5">
                        <p className="text-[14px] leading-relaxed text-[#4D4F46]">
                          {faq.a}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
