"use client";

import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  House, Star, BookOpen, Briefcase, Globe,
  Bell, Heart, Lightning, MusicNote, Camera,
  Code, Rocket, Timer, Trophy, Wallet, Wrench,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { PHOSPHOR_ICON_OPTIONS, COLOR_SWATCHES, type PhosphorIconOption } from "./dockConfig";

const ICON_MAP: Record<PhosphorIconOption, Icon> = {
  House, Star, BookOpen, Briefcase, Globe,
  Bell, Heart, Lightning, MusicNote, Camera,
  Code, Rocket, Timer, Trophy, Wallet, Wrench,
};

const MAX_NAME_LENGTH = 20;

interface AddAppModalProps {
  onClose: () => void;
}

export function AddAppModal({ onClose }: AddAppModalProps) {
  const addDockApp = useMutation(api.dockApps.addDockApp);
  const existingApps = useQuery(api.dockApps.getDockApps);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<"emoji" | "icon">("emoji");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [emoji, setEmoji] = useState("🔗");
  const [selectedIcon, setSelectedIcon] = useState<PhosphorIconOption>("Star");
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const atLimit = (existingApps?.length ?? 0) >= 8;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function validateUrl(value: string): boolean {
    try {
      const u = new URL(value.startsWith("http") ? value : `https://${value}`);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Name is required."); return; }
    if (!url.trim()) { setError("URL is required."); return; }

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    if (!validateUrl(normalizedUrl)) { setError("Please enter a valid URL."); return; }
    if (atLimit) { setError("Maximum 8 custom apps reached."); return; }

    setSubmitting(true);
    try {
      await addDockApp({
        name: name.trim().slice(0, MAX_NAME_LENGTH),
        url: normalizedUrl,
        icon: tab === "emoji" ? emoji : selectedIcon,
        color: tab === "icon" ? selectedColor : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add app.");
    } finally {
      setSubmitting(false);
    }
  }

  const previewIcon = tab === "emoji" ? emoji : selectedIcon;
  const previewColor = tab === "icon" ? selectedColor : "#6B7280";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Add App</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Preview */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: previewColor }}
              >
                {tab === "emoji" ? (
                  <span className="text-2xl">{emoji}</span>
                ) : (
                  (() => {
                    const IconComp = ICON_MAP[selectedIcon];
                    return <IconComp size={26} weight="bold" className="text-white" />;
                  })()
                )}
              </div>
              <span className="text-[11px] font-medium text-gray-500 truncate max-w-[60px]">
                {name || "App name"}
              </span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">
              Name <span className="text-gray-400 font-normal">({MAX_NAME_LENGTH} chars max)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              placeholder="e.g. Gradescope"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="gradescope.com"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Icon tabs */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-2">Icon</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-3">
              {(["emoji", "icon"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={[
                    "flex-1 py-1.5 text-[12px] font-medium transition-colors",
                    tab === t
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {t === "emoji" ? "Emoji" : "Icon"}
                </button>
              ))}
            </div>

            {tab === "emoji" ? (
              <input
                type="text"
                value={emoji}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length > 0) setEmoji(val[val.length - 1] ?? val);
                }}
                placeholder="Paste any emoji"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-[20px] text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-8 gap-1.5">
                  {PHOSPHOR_ICON_OPTIONS.map((iconName) => {
                    const IconComp = ICON_MAP[iconName];
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setSelectedIcon(iconName)}
                        className={[
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                          selectedIcon === iconName
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                        ].join(" ")}
                        aria-label={iconName}
                      >
                        <IconComp size={16} weight="bold" />
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setSelectedColor(swatch)}
                      className={[
                        "w-7 h-7 rounded-full transition-transform",
                        selectedColor === swatch ? "scale-125 ring-2 ring-offset-1 ring-gray-900" : "hover:scale-110",
                      ].join(" ")}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Color ${swatch}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[12px] text-red-600 font-medium">{error}</p>
          )}

          {atLimit && (
            <p className="text-[12px] text-amber-600 font-medium">
              Maximum 8 custom apps reached.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || atLimit}
            className="w-full rounded-lg bg-gray-900 text-white py-2.5 text-[13px] font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Adding…" : "Add App"}
          </button>
        </form>
      </div>
    </div>
  );
}
