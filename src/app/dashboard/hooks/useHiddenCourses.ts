"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nodegent.hiddenCourseIds";

export function useHiddenCourses() {
  const [hiddenCourseIds, setHiddenCourseIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setHiddenCourseIds(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      setHiddenCourseIds([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenCourseIds));
  }, [hiddenCourseIds, loaded]);

  const hiddenCourseIdSet = useMemo(() => new Set<string>(hiddenCourseIds), [hiddenCourseIds]);

  function toggleHidden(courseId: string) {
    setHiddenCourseIds((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId]
    );
  }

  return { hiddenCourseIds, hiddenCourseIdSet, toggleHidden, loaded };
}
