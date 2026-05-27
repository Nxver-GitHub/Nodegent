"use client";

import { Check } from "@phosphor-icons/react";
import { WALLPAPER_PRESETS } from "@/hooks/useWallpaper";

interface WallpaperPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function WallpaperPicker({ value, onChange }: WallpaperPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {WALLPAPER_PRESETS.map((preset) => {
        const selected = preset.id === value;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            aria-label={`Set wallpaper: ${preset.label}`}
            aria-pressed={selected}
            title={preset.label}
            className={`relative h-10 w-full rounded overflow-hidden border-2 transition-all ${
              selected
                ? "border-[#CD8407] shadow-sm"
                : "border-transparent hover:border-gray-300"
            }`}
            style={{ backgroundColor: preset.swatch }}
          >
            {preset.id === "default" && (
              <span
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "url(https://res.cloudinary.com/dmukukwp6/image/upload/carpet_light_27d74f73b5.png)",
                  backgroundSize: "40px 40px",
                  backgroundRepeat: "repeat",
                }}
              />
            )}
            {selected && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Check
                  size={14}
                  weight="bold"
                  className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
