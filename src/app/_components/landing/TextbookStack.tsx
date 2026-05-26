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
    body: "Free forever. Powered by Meta Llama via Groq. Every agent action is logged and auditable — you're always in control of what the AI can and can't do.",
  },
];

export function TextbookStack({ className = "" }: { className?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className={`flex flex-row items-center gap-2 ${className}`}>
      {/* Spine column */}
      <div className="flex flex-col gap-1.5">
        {BOOKS.map((b, i) => (
          <button
            key={b.title}
            className="textbook-spine w-36 cursor-pointer text-left"
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
        ))}
        <p className="mt-1.5 text-[11px] font-medium text-gray-600">click to open →</p>
      </div>

      {/* Content panel — slides in horizontally to the right */}
      <AnimatePresence>
        {openIdx !== null && (
          <motion.div
            key={openIdx}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 200, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div
              className="brutal-border w-[200px] rounded-md bg-white px-4 py-3"
              style={{ borderLeft: `4px solid ${BOOKS[openIdx].color}` }}
            >
              <p
                className="mb-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: BOOKS[openIdx].color }}
              >
                {BOOKS[openIdx].heading}
              </p>
              <p className="text-[12px] leading-relaxed text-gray-800">
                {BOOKS[openIdx].body}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
