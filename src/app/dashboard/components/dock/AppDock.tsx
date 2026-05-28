"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DEFAULT_APPS, type DockApp, type DockAppId } from "./dockConfig";
import { DockIcon } from "./DockIcon";
import { AddAppModal } from "./AddAppModal";
import { ConfirmDialog } from "../ConfirmDialog";

interface AppDockProps {
  openWindows: DockAppId[];
  onAppClick: (app: DockApp) => void;
}

interface CustomApp {
  _id: Id<"dockApps">;
  name: string;
  url: string;
  icon: string;
  color?: string;
  order: number;
}

interface SortableDockIconProps {
  app: CustomApp;
  onRemove: (id: Id<"dockApps">, name: string) => void;
}

function SortableDockIcon({ app, onRemove }: SortableDockIconProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: app._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DockIcon
        label={app.name}
        icon={app.icon}
        color={app.color ?? "#6B7280"}
        active={false}
        onClick={() => window.open(app.url, "_blank", "noopener,noreferrer")}
        onRemove={() => onRemove(app._id, app.name)}
        removeLabel="Remove"
      />
    </div>
  );
}

export function AppDock({ openWindows, onAppClick }: AppDockProps) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const customApps = useQuery(api.dockApps.getDockApps);
  const deleteDockApp = useMutation(api.dockApps.deleteDockApp);
  const reorderDockApps = useMutation(api.dockApps.reorderDockApps);
  const toggleHide = useMutation(api.dockApps.toggleHideDefaultApp);

  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: Id<"dockApps">; name: string } | null>(null);
  const [confirmHide, setConfirmHide] = useState<{ id: string; name: string } | null>(null);
  const [localApps, setLocalApps] = useState<CustomApp[] | null>(null);

  const hiddenDefaultApps = currentUser?.hiddenDefaultApps ?? [];
  const visibleDefaults = DEFAULT_APPS.filter((a) => !hiddenDefaultApps.includes(a.id));
  const displayedCustomApps = localApps ?? customApps ?? [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const apps = localApps ?? customApps ?? [];
    const oldIndex = apps.findIndex((a) => a._id === active.id);
    const newIndex = apps.findIndex((a) => a._id === over.id);
    const reordered = arrayMove(apps, oldIndex, newIndex);

    setLocalApps(reordered);
    try {
      await reorderDockApps({ ids: reordered.map((a) => a._id) });
    } catch {
      setLocalApps(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    try {
      await deleteDockApp({ id: confirmDelete.id });
      if (localApps) {
        setLocalApps(localApps.filter((a) => a._id !== confirmDelete.id));
      }
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleConfirmHide() {
    if (!confirmHide) return;
    try {
      await toggleHide({ appId: confirmHide.id });
    } finally {
      setConfirmHide(null);
    }
  }

  const atLimit = (customApps?.length ?? 0) >= 8;

  return (
    <>
      <aside className="hidden md:flex flex-col gap-3 pt-20 px-3 w-[176px] flex-shrink-0 min-h-screen overflow-y-auto scrollbar-none">
        {/* Default apps — single column */}
        <div className="flex flex-col gap-4">
          {visibleDefaults.map((app) => (
            <DockIcon
              key={app.id}
              label={app.label}
              icon={app.phosphorIcon}
              color={app.color}
              active={openWindows.includes(app.id)}
              onClick={() => onAppClick(app)}
              onRemove={app.hideable ? () => setConfirmHide({ id: app.id, name: app.label }) : undefined}
              removeLabel="Hide"
              tooltip={app.tooltip}
              hideable={app.hideable}
            />
          ))}
        </div>

        {/* Separator */}
        <hr className="border-white/30 mx-1" />

        {/* Custom apps — sortable single column */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={displayedCustomApps.map((a) => a._id)}
            strategy={rectSortingStrategy}
          >
            <div className="flex flex-col gap-4">
              {displayedCustomApps.map((app) => (
                <SortableDockIcon
                  key={app._id}
                  app={app}
                  onRemove={(id, name) => setConfirmDelete({ id, name })}
                />
              ))}

              {!atLimit && (
                <button
                  onClick={() => setShowAddModal(true)}
                  aria-label="Add custom app"
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-white/50 flex items-center justify-center text-white/60 text-2xl font-light hover:border-white/80 hover:text-white/90 transition-colors group-hover:opacity-100 opacity-60">
                    +
                  </div>
                  <span className="text-[11px] font-medium text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] group-hover:text-white/90 transition-colors">
                    Add App
                  </span>
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </aside>

      {showAddModal && <AddAppModal onClose={() => setShowAddModal(false)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Remove "${confirmDelete?.name}"?`}
        message="This app will be removed from your dock. You can add it back anytime."
        confirmLabel="Remove"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmHide}
        title={`Hide "${confirmHide?.name}" from dock?`}
        message="You can restore it from Settings."
        confirmLabel="Hide"
        onConfirm={handleConfirmHide}
        onCancel={() => setConfirmHide(null)}
      />
    </>
  );
}
