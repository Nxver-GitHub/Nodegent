"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nodegent.courseColors";

export function useCourseColors() {
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const valid: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string") valid[k] = v;
        }
        setColorOverrides(valid);
      }
    } catch {
      setColorOverrides({});
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colorOverrides));
  }, [colorOverrides, loaded]);

  function setColor(courseId: string, color: string) {
    setColorOverrides((prev) => ({ ...prev, [courseId]: color }));
  }

  function resetColor(courseId: string) {
    setColorOverrides((prev) => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  }

  return { colorOverrides, setColor, resetColor, loaded };
}
