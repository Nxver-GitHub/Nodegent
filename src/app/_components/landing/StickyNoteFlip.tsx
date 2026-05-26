"use client";
import { useState, useEffect } from "react";

const NOTES = [
  {
    cls: "sticky-yellow",
    rotate: -6,
    text: "📌 no more missed deadlines!",
    hint: "auto-synced from Canvas",
  },
  {
    cls: "sticky-pink",
    rotate: 5,
    text: "✨ AI already knows your schedule",
    hint: "just ask it anything",
  },
];

export function StickyNoteFlip() {
  const [front, setFront] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFront((f) => (f + 1) % NOTES.length), 3500);
    return () => clearInterval(t);
  }, []);

  const cycle = () => setFront((f) => (f + 1) % NOTES.length);
  const back = (front + 1) % NOTES.length;

  return (
    <div
      className="relative h-[120px] w-[320px] cursor-pointer select-none"
      onClick={cycle}
      title="click to flip"
      aria-label="Flip sticky note"
    >
      {/* Back note — peeking out behind */}
      <div
        className={`sticky ${NOTES[back].cls} font-hand absolute left-4 top-2 w-[280px] text-gray-900`}
        style={{
          transform: `rotate(${NOTES[back].rotate}deg)`,
          zIndex: 10,
          opacity: 0.82,
        }}
      >
        <p className="text-[15px] leading-snug">{NOTES[back].text}</p>
        <p className="mt-1 text-[11px] opacity-60">{NOTES[back].hint}</p>
      </div>

      {/* Front note */}
      <div
        className={`sticky ${NOTES[front].cls} font-hand absolute left-0 top-0 w-[280px] text-gray-900 transition-all duration-500`}
        style={{
          transform: `rotate(${NOTES[front].rotate}deg)`,
          zIndex: 20,
        }}
      >
        <p className="text-[15px] leading-snug">{NOTES[front].text}</p>
        <p className="mt-1 text-[11px] opacity-60">{NOTES[front].hint}</p>
      </div>

      <p className="font-hand absolute -bottom-5 left-2 text-[10px] text-gray-400">
        click to flip →
      </p>
    </div>
  );
}
