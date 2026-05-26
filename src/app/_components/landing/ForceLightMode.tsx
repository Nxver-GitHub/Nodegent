"use client";
import { useEffect } from "react";

const STORAGE_KEY = "nodegent-theme";

// Forces light mode while the landing page is mounted.
// On unmount (client-side nav away), restores the user's stored preference.
export function ForceLightMode() {
  useEffect(() => {
    document.documentElement.classList.add("light");
    return () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== "light") {
        document.documentElement.classList.remove("light");
      }
    };
  }, []);
  return null;
}
