"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BOOKS = [
  {
    title: "CAMPUS SYNC",
    color: "#3B82F6",
    rotate: -2,
    heading: "Ch. 1 — Connecting Your Campus",
    body: "Link Canvas, Google Calendar, and your campus portal in one click. Assignments auto-sync the moment they’re posted — no manual imports, no missed deadlines.",
  },
  {
    title: "AI ASSISTANT",
    color: "#CD8407",
    rotate: 1,
    heading: "Ch. 2 — Your Campus-Aware AI",
    body: "Ask anything about your workload. Your assistant already knows every assignment, deadline, and class time — answers grounded in your actual data.",
  },
  {
    title: "MY SCHEDULE",
    color: "#F34D52",
    rotate: -1,
    heading: "Ch. 3 — Urgency-Sorted Dashboard",
    body: "All assignments sorted by how soon they’re due. Daily snapshot, calendar view, and course list — one focused desktop for student life.",
  },
  {
    title: "NODEGENT",
    color: "#1D1D1D",
    rotate: 2,
    heading: "Ch. 4 — Built for Students",
    body: "Free forever. Bring your own API key. Every agent action is logged and auditable — you’re always in control of what the AI can and can’t do.",
  },
];

export function TextbookStack({ className = "" }: { className?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {BOOKS.map((b, i) => (
        <div key={b.title}>
          <button
            className="textbook-spine w-full cursor-pointer text-left"
            style={{
              backgroundColor: b.color,
              transform: openIdx === i ? "rotate(0deg) scale(1.03)" : `rotate(${b.rotate}deg)`,
              transition: "transform 0.2s ease",
            }}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            aria-expanded={openIdx === i}
            aria-label={`${b.title} — ${openIdx === i ? "close" : "learn more"}`}
          >
            {b.title}
          </button>

          <AnimatePresence>
            {openIdx === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div
                  className="brutal-border mt-1.5 rounded-md bg-white px-4 py-3"
                  style={{ borderLeft: `4px solid ${b.color}` }}
                >
                  <p
                    className="mb-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: b.color }}
                  >
                    {b.heading}
                  </p>
                  <p className="text-[12px] leading-relaxed text-gray-800">{b.body}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <p className="mt-1 text-[10px] text-gray-500">click any spine to open →</p>
    </div>
  );
}
