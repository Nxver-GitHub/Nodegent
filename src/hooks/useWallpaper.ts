import { useState, useCallback } from "react";

export interface WallpaperPreset {
  id: string;
  label: string;
  style: React.CSSProperties;
  /** CSS color used for the swatch thumbnail */
  swatch: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "default",
    label: "Carpet",
    style: {},
    swatch: "#EEEFE9",
  },
  {
    id: "midnight",
    label: "Midnight",
    style: { background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0d0d0d 100%)" },
    swatch: "#1a1a2e",
  },
  {
    id: "forest",
    label: "Forest",
    style: { background: "linear-gradient(135deg, #1a2010 0%, #2d3a1a 50%, #141a0c 100%)" },
    swatch: "#2d3a1a",
  },
  {
    id: "dusk",
    label: "Dusk",
    style: { background: "linear-gradient(135deg, #1a1025 0%, #2d1b3d 50%, #150d20 100%)" },
    swatch: "#2d1b3d",
  },
  {
    id: "slate",
    label: "Slate",
    style: { background: "linear-gradient(135deg, #1c2128 0%, #2d3748 50%, #161b22 100%)" },
    swatch: "#2d3748",
  },
  {
    id: "warm-cream",
    label: "Warm Cream",
    style: { background: "linear-gradient(135deg, #f5f0e8 0%, #ede5d5 50%, #f8f4ee 100%)" },
    swatch: "#ede5d5",
  },
  {
    id: "coffee",
    label: "Coffee",
    style: { background: "linear-gradient(135deg, #2c1a0e 0%, #3d2410 50%, #1e1008 100%)" },
    swatch: "#3d2410",
  },
  {
    id: "ocean",
    label: "Ocean",
    style: { background: "linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #071020 100%)" },
    swatch: "#0d2137",
  },
  {
    id: "ash",
    label: "Ash",
    style: { background: "#111111" },
    swatch: "#111111",
  },
  {
    id: "paper",
    label: "Paper",
    style: { background: "#f8f8f6" },
    swatch: "#f8f8f6",
  },
  {
    id: "amber-glow",
    label: "Amber Glow",
    style: { background: "linear-gradient(135deg, #1a1208 0%, #2e1f08 50%, #3d2a0a 100%)" },
    swatch: "#2e1f08",
  },
  {
    id: "sage",
    label: "Sage",
    style: { background: "linear-gradient(135deg, #e8ede4 0%, #d8e0d2 50%, #edf0ea 100%)" },
    swatch: "#d8e0d2",
  },
];

const STORAGE_KEY = "nodegent_wallpaper";

function readFromStorage(): string {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(STORAGE_KEY) ?? "default";
}

export function useWallpaper(): [string, (id: string) => void] {
  const [wallpaperId, setWallpaperId] = useState<string>(readFromStorage);

  const setWallpaper = useCallback((id: string) => {
    setWallpaperId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  return [wallpaperId, setWallpaper];
}

export function getWallpaperStyle(id: string): React.CSSProperties {
  const preset = WALLPAPER_PRESETS.find((p) => p.id === id);
  return preset?.style ?? {};
}
