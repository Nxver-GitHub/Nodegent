"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CaretRight, NotePencil, Plus, X } from "@phosphor-icons/react";
import {
  MAX_NOTE_CONTENT_CHARS,
  formatRelativeTime,
  isCancelKey,
  isSubmitKey,
  validateNoteDraft,
} from "./courseNotes.helpers";

interface CourseNotesSectionProps {
  courseId: Id<"courses">;
  courseCode: string;
}

// Stop card-level onClick (which opens CourseDetailDrawer) from firing
// when the user is interacting with the Notes disclosure.
function stop(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export function CourseNotesSection({
  courseId,
  courseCode,
}: CourseNotesSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `course-notes-panel-${courseId}`;
  const toggleId = `course-notes-toggle-${courseId}`;

  return (
    <div
      className="mt-3 border-t border-gray-100 pt-2"
      onClick={stop}
      onMouseDown={stop}
    >
      <button
        type="button"
        id={toggleId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={(e) => {
          stop(e);
          setIsOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1 py-1"
      >
        <span className="flex items-center gap-1.5">
          <NotePencil size={12} weight="bold" />
          Notes
        </span>
        <CaretRight
          size={12}
          weight="bold"
          className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
      </button>

      {isOpen && (
        <CourseNotesList
          courseId={courseId}
          courseCode={courseCode}
          panelId={panelId}
          toggleId={toggleId}
        />
      )}
    </div>
  );
}

interface CourseNotesListProps {
  courseId: Id<"courses">;
  courseCode: string;
  panelId: string;
  toggleId: string;
}

function CourseNotesList({
  courseId,
  courseCode,
  panelId,
  toggleId,
}: CourseNotesListProps) {
  const notes = useQuery(api.courseNotes.listCourseNotes, { courseId });
  const addNote = useMutation(api.courseNotes.addCourseNote);

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={toggleId}
      className="mt-2 space-y-2"
    >
      <AddNoteInput
        courseCode={courseCode}
        onAdd={async (content) => {
          await addNote({ courseId, content });
        }}
      />

      {notes === undefined && (
        <p className="text-xs text-gray-400 px-1 py-1">Loading notes…</p>
      )}

      {notes !== undefined && notes.length === 0 && (
        <p className="text-xs text-gray-400 px-1 py-1 italic">
          No notes yet. Add one above.
        </p>
      )}

      {notes !== undefined && notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map((note) => (
            <li key={note._id}>
              <NoteItem
                noteId={note._id}
                content={note.content}
                createdAt={note.createdAt}
                updatedAt={note.updatedAt}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddNoteInput({
  courseCode,
  onAdd,
}: {
  courseCode: string;
  onAdd: (content: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validity = validateNoteDraft(draft);
  const canSubmit = validity.ok && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!validity.ok) {
      setError(validity.reason === "empty" ? null : "Note too long");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(validity.trimmed);
      setDraft("");
    } catch {
      setError("Couldn't save — try again");
    } finally {
      setSubmitting(false);
    }
  }, [validity, onAdd]);

  return (
    <div className="flex items-start gap-1.5">
      <textarea
        rows={1}
        value={draft}
        maxLength={MAX_NOTE_CONTENT_CHARS}
        placeholder={`Add a note for ${courseCode}…`}
        aria-label={`Add a note for ${courseCode}`}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (isSubmitKey(e)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        onClick={stop}
        onMouseDown={stop}
        className="block flex-1 min-h-7 resize-y rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
      />
      <button
        type="button"
        aria-label="Add note"
        disabled={!canSubmit}
        onClick={(e) => {
          stop(e);
          void handleSubmit();
        }}
        className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <Plus size={14} weight="bold" />
      </button>
      {error && (
        <p className="absolute mt-8 text-[10px] text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface NoteItemProps {
  noteId: Id<"courseNotes">;
  content: string;
  createdAt: number;
  updatedAt: number;
}

function NoteItem({ noteId, content, createdAt, updatedAt }: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateNote = useMutation(api.courseNotes.updateCourseNote);
  const deleteNote = useMutation(api.courseNotes.deleteCourseNote);

  if (isEditing) {
    return (
      <NoteEditor
        initialContent={content}
        onCancel={() => setIsEditing(false)}
        onSave={async (next) => {
          if (next === content) {
            setIsEditing(false);
            return;
          }
          await updateNote({ noteId, content: next });
          setIsEditing(false);
        }}
      />
    );
  }

  const isEdited = updatedAt > createdAt + 1500; // ignore millisecond fuzz
  const timestamp = formatRelativeTime(isEdited ? updatedAt : createdAt);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Edit note"
      onClick={(e) => {
        stop(e);
        setIsEditing(true);
      }}
      onMouseDown={stop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
      className="group relative rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-text"
    >
      <p className="whitespace-pre-wrap break-words pr-5">{content}</p>
      <span className="mt-0.5 block text-[10px] text-gray-400">
        {isEdited ? `Edited ${timestamp}` : timestamp}
      </span>
      <button
        type="button"
        aria-label="Delete note"
        onClick={(e) => {
          stop(e);
          void deleteNote({ noteId });
        }}
        onMouseDown={stop}
        className="absolute top-1 right-1 inline-flex items-center justify-center h-5 w-5 rounded text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-red-50 hover:text-red-500 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition-opacity"
      >
        <X size={11} weight="bold" />
      </button>
    </div>
  );
}

function NoteEditor({
  initialContent,
  onSave,
  onCancel,
}: {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    // place caret at end on edit-open
    const len = ref.current?.value.length ?? 0;
    ref.current?.setSelectionRange(len, len);
  }, []);

  const handleSave = useCallback(async () => {
    const validity = validateNoteDraft(draft);
    if (!validity.ok) {
      if (validity.reason === "empty") {
        onCancel();
      } else {
        setError("Note too long");
      }
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(validity.trimmed);
    } catch {
      setError("Couldn't save — try again");
      setSaving(false);
    }
  }, [draft, onSave, onCancel]);

  return (
    <div className="rounded-md border border-blue-300 bg-white px-2 py-1.5">
      <textarea
        ref={ref}
        value={draft}
        maxLength={MAX_NOTE_CONTENT_CHARS}
        aria-label="Edit note"
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (isSubmitKey(e)) {
            e.preventDefault();
            void handleSave();
          } else if (isCancelKey(e)) {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          // Save on blur so click-away commits the edit. If the draft
          // collapses to empty, cancel instead of erroring.
          void handleSave();
        }}
        onClick={stop}
        onMouseDown={stop}
        disabled={saving}
        className="block w-full min-h-7 resize-y text-xs text-gray-800 bg-transparent focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
        <span>Enter to save · Esc to cancel</span>
        {error && (
          <span className="text-red-500" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
