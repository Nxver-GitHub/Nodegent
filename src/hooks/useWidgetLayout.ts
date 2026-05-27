import { useState, useCallback } from "react";

export type WidgetId = "snapshot" | "assignments" | "schedule";

export interface WidgetConfig {
  id: WidgetId;
  label: string;
  visible: boolean;
}

const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: "snapshot", label: "Snapshot", visible: true },
  { id: "assignments", label: "Assignment List", visible: true },
  { id: "schedule", label: "Today's Schedule", visible: true },
];

const STORAGE_KEY = "nodegent_widget_layout";

function readFromStorage(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;
    // Validate and merge against defaults to handle added/removed widgets
    const validIds = new Set<WidgetId>(["snapshot", "assignments", "schedule"]);
    const stored = parsed.filter(
      (item): item is WidgetConfig =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        validIds.has((item as WidgetConfig).id) &&
        "visible" in item &&
        typeof (item as WidgetConfig).visible === "boolean"
    );
    // Add any missing widgets at the end
    const storedIds = new Set(stored.map((w) => w.id));
    const missing = DEFAULT_LAYOUT.filter((w) => !storedIds.has(w.id));
    return [...stored, ...missing];
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function writeToStorage(layout: WidgetConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export interface UseWidgetLayoutReturn {
  layout: WidgetConfig[];
  setVisible: (id: WidgetId, visible: boolean) => void;
  moveUp: (id: WidgetId) => void;
  moveDown: (id: WidgetId) => void;
}

export function useWidgetLayout(): UseWidgetLayoutReturn {
  const [layout, setLayout] = useState<WidgetConfig[]>(readFromStorage);

  const update = useCallback((next: WidgetConfig[]) => {
    setLayout(next);
    writeToStorage(next);
  }, []);

  const setVisible = useCallback(
    (id: WidgetId, visible: boolean) => {
      update(
        layout.map((w) => (w.id === id ? { ...w, visible } : w))
      );
    },
    [layout, update]
  );

  const moveUp = useCallback(
    (id: WidgetId) => {
      const idx = layout.findIndex((w) => w.id === id);
      if (idx <= 0) return;
      const next = [...layout];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      update(next);
    },
    [layout, update]
  );

  const moveDown = useCallback(
    (id: WidgetId) => {
      const idx = layout.findIndex((w) => w.id === id);
      if (idx < 0 || idx >= layout.length - 1) return;
      const next = [...layout];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      update(next);
    },
    [layout, update]
  );

  return { layout, setVisible, moveUp, moveDown };
}
