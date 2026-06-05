"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { X, Pause, Play, SkipForward } from "@phosphor-icons/react";

const WORK_DURATION = 25 * 60; // 1500 seconds
const BREAK_DURATION = 5 * 60; // 300 seconds

type Phase = "work" | "prompt" | "break" | "idle";

interface StudyTimerOverlayProps {
  assignment: { _id: string; title: string; courseCode?: string };
  onClose: () => void;
  onMarkDone: () => void;
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Web Audio API not available — silently skip
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function StudyTimerOverlay({
  assignment,
  onClose,
  onMarkDone,
}: StudyTimerOverlayProps) {
  const [phase, setPhase] = useState<Phase>("work");
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION);
  const [running, setRunning] = useState(true);
  const logPomodoro = useMutation(api.auditLog.logPomodoroSession);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Escape key closes the overlay
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Timer tick
  useEffect(() => {
    if (!running || phase === "prompt" || phase === "idle") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          if (phase === "work") {
            playBeep();
            setRunning(false);
            setPhase("prompt");
          } else if (phase === "break") {
            playBeep();
            setRunning(false);
            setPhase("idle");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, phase]);

  function handleSkip() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (phase === "work") {
      playBeep();
      setRunning(false);
      setPhase("prompt");
      setTimeLeft(0);
    } else if (phase === "break") {
      setRunning(false);
      setPhase("idle");
      setTimeLeft(0);
    }
  }

  function handleStartBreak() {
    // Log the completed Pomodoro session to the audit log
    logPomodoro({
      assignmentTitle: assignment.title,
      durationSeconds: WORK_DURATION,
    }).catch(() => {
      // Non-critical — silently ignore audit log errors
    });
    setPhase("break");
    setTimeLeft(BREAK_DURATION);
    setRunning(true);
  }

  function handleMarkDone() {
    logPomodoro({
      assignmentTitle: assignment.title,
      durationSeconds: WORK_DURATION,
    }).catch(() => {});
    onMarkDone();
  }

  function handleTogglePause() {
    setRunning((v) => !v);
  }

  const phaseLabel =
    phase === "work"
      ? "Focus"
      : phase === "break"
        ? "Break"
        : phase === "prompt"
          ? "Session complete!"
          : "Done";

  const ringColor =
    phase === "work"
      ? "stroke-[#CD8407]"
      : phase === "break"
        ? "stroke-blue-400"
        : "stroke-green-500";

  const totalDuration = phase === "break" ? BREAK_DURATION : WORK_DURATION;
  const progress =
    phase === "prompt" || phase === "idle"
      ? 1
      : (totalDuration - timeLeft) / totalDuration;
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - progress);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Study timer"
        className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
      >
        <div className="pointer-events-auto w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#CD8407]">
                {assignment.courseCode ?? "Assignment"}
              </p>
              <p className="text-[13px] font-bold text-gray-800 leading-tight truncate mt-0.5 max-w-[220px]">
                {assignment.title}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close timer"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-2"
            >
              <X size={14} weight="bold" />
            </button>
          </div>

          {/* Timer ring */}
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="relative w-32 h-32">
              <svg
                className="w-32 h-32 -rotate-90"
                viewBox="0 0 120 120"
                aria-hidden="true"
              >
                {/* Track */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="8"
                />
                {/* Progress */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className={`transition-all duration-1000 ${ringColor}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[28px] font-mono font-extrabold text-gray-900 leading-none tabular-nums">
                  {phase === "prompt" || phase === "idle"
                    ? "00:00"
                    : formatTime(timeLeft)}
                </span>
                <span className="text-[11px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">
                  {phaseLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="px-5 pb-5 flex flex-col gap-3">
            {(phase === "work" || phase === "break") && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePause}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-bold hover:bg-gray-700 transition-colors"
                >
                  {running ? (
                    <>
                      <Pause size={14} weight="bold" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play size={14} weight="bold" />
                      Resume
                    </>
                  )}
                </button>
                <button
                  onClick={handleSkip}
                  title="Skip to end of phase"
                  aria-label="Skip"
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors"
                >
                  <SkipForward size={14} weight="bold" />
                </button>
              </div>
            )}

            {phase === "prompt" && (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-gray-600 text-center">
                  Great work! Mark this assignment as done?
                </p>
                <button
                  onClick={handleMarkDone}
                  className="w-full py-2 rounded-lg bg-green-600 text-white text-[13px] font-bold hover:bg-green-700 transition-colors"
                >
                  Mark as done
                </button>
                <button
                  onClick={handleStartBreak}
                  className="w-full py-2 rounded-lg border border-gray-200 text-gray-600 text-[13px] font-semibold hover:bg-gray-50 transition-colors"
                >
                  Not yet — take a break
                </button>
              </div>
            )}

            {phase === "idle" && (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-gray-600 text-center">
                  Break&apos;s over. Ready for another round?
                </p>
                <button
                  onClick={() => {
                    setPhase("work");
                    setTimeLeft(WORK_DURATION);
                    setRunning(true);
                  }}
                  className="w-full py-2 rounded-lg bg-gray-900 text-white text-[13px] font-bold hover:bg-gray-700 transition-colors"
                >
                  Start another session
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 rounded-lg border border-gray-200 text-gray-600 text-[13px] font-semibold hover:bg-gray-50 transition-colors"
                >
                  Done for now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
