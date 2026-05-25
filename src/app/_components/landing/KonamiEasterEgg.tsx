"use client";

import { useEffect, useState } from "react";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

const COLORS = ["#CD8407", "#EB9D2A", "#F34D52", "#7CC36E", "#3B82F6", "#1D1D1D"];
const CONFETTI_COUNT = 60;

/**
 * Hidden landing-page easter egg. Type the classic Konami code
 * (↑ ↑ ↓ ↓ ← → ← → B A) anywhere on the page and a brand-colored
 * confetti shower rains down for a few seconds. Pure decoration.
 */
export function KonamiEasterEgg() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let buffer: string[] = [];
    function onKey(e: KeyboardEvent) {
      // Normalize so b/B and a/A both count
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buffer = [...buffer, key].slice(-KONAMI.length);
      if (
        buffer.length === KONAMI.length &&
        buffer.every((k, i) => k === KONAMI[i])
      ) {
        setActive(true);
        window.setTimeout(() => setActive(false), 4800);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden"
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: COLORS[i % COLORS.length],
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${2.2 + Math.random() * 1.8}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
            opacity: 0.95,
          }}
        />
      ))}
      <div className="sticky-note font-hand absolute left-1/2 top-10 -translate-x-1/2 rotate-[-3deg] rounded-sm px-4 py-2 text-center text-gray-900">
        <p className="text-[20px] leading-tight">you found it! 🎉</p>
        <p className="text-[14px] text-gray-700">welcome to Nodegent.</p>
      </div>
    </div>
  );
}
