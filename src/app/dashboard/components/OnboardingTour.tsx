"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X, Graph } from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

interface TourStep {
  targetId: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    targetId: "tour-connect-lms",
    title: "Connect your LMS",
    description:
      "Start here — link your Canvas account to pull in your courses, assignments, and deadlines automatically.",
  },
  {
    targetId: "tour-campus-sync",
    title: "Campus Sync",
    description:
      "See the status of your Canvas and Google Calendar connections and manage your data sync settings.",
  },
  {
    targetId: "tour-ai-chat",
    title: "AI Chat",
    description:
      "Chat with Nodegent — it already knows your schedule, courses, and assignments so you don't have to explain anything.",
  },
  {
    targetId: "tour-notification-bell",
    title: "Notifications",
    description:
      "Get notified when new assignments are posted to Canvas so you never miss a deadline.",
  },
  {
    targetId: "tour-my-dashboard",
    title: "My Dashboard",
    description:
      "Your central hub — view upcoming assignments, deadlines, and a daily snapshot of your academic week.",
  },
  {
    targetId: "tour-security",
    title: "Security & Access",
    description:
      "Review exactly what Nodegent can access on your behalf and revoke any permission instantly.",
  },
];


const UNIVERSITIES = [
  { value: "ucsc",       label: "UC Santa Cruz"  },
  { value: "ucberkeley", label: "UC Berkeley"    },
  { value: "ucla",       label: "UCLA"           },
  { value: "ucsd",       label: "UC San Diego"   },
  { value: "ucdavis",   label: "UC Davis"        },
  { value: "stanford",   label: "Stanford"       },
] as const;

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 300;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computeTooltipPosition(
  rect: Rect,
  vpWidth: number,
  vpHeight: number
): { top: number; left: number } {
  const belowTop = rect.top + rect.height + TOOLTIP_GAP;
  const aboveTop = rect.top - TOOLTIP_GAP - 160;
  const placeBelow = belowTop + 180 < vpHeight;
  const top = placeBelow ? belowTop : Math.max(8, aboveTop);

  let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.max(12, Math.min(left, vpWidth - TOOLTIP_WIDTH - 12));

  return { top, left };
}

interface OnboardingTourProps {
  onComplete: () => void;
  userUniversity?: string | null;
}

export function OnboardingTour({ onComplete, userUniversity }: OnboardingTourProps) {
  const updateUniversity = useMutation(api.users.updateUniversity);
  const [step, setStep] = useState(userUniversity ? 0 : -1);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState<string>("");
  const [universityError, setUniversityError] = useState<string>("");
  const rafRef = useRef<number | null>(null);

  const current = step >= 0 ? STEPS[step] : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track target element position via rAF so it stays in sync with layout
  useLayoutEffect(() => {
    if (!mounted || !current) return;

    function updateRect() {
      setTargetRect(getTargetRect(current!.targetId));
    }

    updateRect();

    function loop() {
      updateRect();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, current]);

  // Keyboard: Escape to skip, Enter/→ to advance
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onComplete();
      if (e.key === "Enter" || e.key === "ArrowRight") handleNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete();
    }
  }

  if (!mounted) return null;

  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;

  const tooltipPos = (current && targetRect)
    ? computeTooltipPosition(targetRect, vpWidth, vpHeight)
    : { top: vpHeight / 2 - 80, left: vpWidth / 2 - TOOLTIP_WIDTH / 2 };

  const isLast = step === STEPS.length - 1;

  // University picker step (step === -1) — full-screen welcome modal
  if (step === -1) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="University selection"
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 flex flex-col gap-6 w-full"
          style={{ maxWidth: 480 }}
        >
          {/* Branding */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#CD8407] flex items-center justify-center shadow-sm">
              <Graph size={20} weight="bold" className="text-white" />
            </div>
            <span className="text-[16px] font-bold text-gray-900 tracking-tight">Nodegent</span>
          </div>

          {/* Headline */}
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 leading-tight mb-1.5">
              Welcome! Let&apos;s get you set up.
            </h2>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              Nodegent connects to your university&apos;s Canvas to pull in your courses,
              assignments, and deadlines automatically.
            </p>
          </div>

          {/* University tiles */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Which university do you attend?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {UNIVERSITIES.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => { setSelectedUniversity(u.value); setUniversityError(""); }}
                  className={`flex items-center justify-center text-center px-2 py-3.5 rounded-xl border text-[13px] font-medium transition-all leading-tight ${
                    selectedUniversity === u.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
            {universityError && (
              <p className="text-[12px] text-red-500 mt-2">{universityError}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onComplete}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={async () => {
                if (!selectedUniversity) {
                  setUniversityError("Please select your university to continue.");
                  return;
                }
                await updateUniversity({ university: selectedUniversity });
                setStep(0);
              }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              Continue <ArrowRight size={14} weight="bold" />
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      {/* Dark overlay — clicking it skips the tour */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onComplete}
        aria-hidden="true"
      />

      {/* Spotlight cutout around target element */}
      {targetRect && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: targetRect.top - 5,
            left: targetRect.left - 5,
            width: targetRect.width + 10,
            height: targetRect.height + 10,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            borderRadius: 6,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding step ${step + 1} of ${STEPS.length}: ${current!.title}`}
        className="fixed z-[10000] bg-white rounded-xl shadow-2xl border border-gray-100 p-5 flex flex-col gap-3"
        style={{ width: TOOLTIP_WIDTH, top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Counter + close */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-wider">
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={onComplete}
            className="text-gray-300 hover:text-gray-600 transition-colors"
            aria-label="Skip tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-blue-500"
                  : i < step
                  ? "w-2 bg-blue-200"
                  : "w-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 mb-1">{current!.title}</h3>
          <p className="text-[13px] text-gray-600 leading-relaxed">{current!.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onComplete}
            className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ArrowRight size={14} weight="bold" />}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
