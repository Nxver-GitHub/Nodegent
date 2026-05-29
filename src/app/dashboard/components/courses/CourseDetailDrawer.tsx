"use client";

import { useState, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { X, PencilSimple, Check, Robot, EnvelopeSimple, UserCircle, CalendarBlank } from "@phosphor-icons/react";

interface OfficeHoursData {
  days?: string;
  time?: string;
  location?: string;
  zoomUrl?: string | null;
  source?: "auto" | "manual";
}

interface TaEntry {
  name: string;
  email?: string;
  officeHours?: string;
}

export interface CourseForDrawer {
  _id: Id<"courses">;
  canvasId: string;
  name: string;
  courseCode: string;
  instructorName?: string;
  instructorEmail?: string;
  officeHours?: string;
  tasJson?: string;
  selectedTaEmail?: string;
  courseScore?: number;
  courseGrade?: string;
  calendarSync?: boolean;
}

function parseOfficeHours(raw: string | undefined): OfficeHoursData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OfficeHoursData;
  } catch {
    return null;
  }
}

function safeHttpUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : null;
  } catch {
    return null;
  }
}

function parseTas(raw: string | undefined): TaEntry[] {
  if (!raw) return [];
  try {
    const tas = JSON.parse(raw) as TaEntry[];
    const seen = new Set<string>();
    return tas.filter((ta) => {
      const key = ta.email ?? ta.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

function OfficeHoursDisplay({ data, onEdit }: { data: OfficeHoursData; onEdit: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1.5">
        {data.days && (
          <p className="text-sm text-gray-700">
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide mr-1.5">Days</span>
            {data.days}
          </p>
        )}
        {data.time && (
          <p className="text-sm text-gray-700">
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide mr-1.5">Time</span>
            {data.time}
          </p>
        )}
        {data.location && (
          <p className="text-sm text-gray-700">
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide mr-1.5">Location</span>
            {data.location}
          </p>
        )}
{(() => { const safeZoom = safeHttpUrl(data.zoomUrl); return safeZoom ? (
          <a
            href={safeZoom}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-blue-600 hover:underline mt-0.5"
          >
            Join Zoom &rarr;
          </a>
        ) : null; })()}
      </div>
      <button
        onClick={onEdit}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
      >
        <PencilSimple size={11} />
        {data.source === "auto" ? "Auto-detected · Edit" : "Edit"}
      </button>
    </div>
  );
}

function OfficeHoursForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: OfficeHoursData | null;
  saving: boolean;
  onSave: (data: OfficeHoursData) => void;
  onCancel: () => void;
}) {
  const [days, setDays] = useState(initial?.days ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [zoom, setZoom] = useState(initial?.zoomUrl ?? "");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Days</label>
          <input value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. Mon/Wed"
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Time</label>
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 2-4pm"
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-gray-500 font-medium block mb-1">Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Baskin Eng 375"
          className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
      </div>
      <div>
        <label className="text-[11px] text-gray-500 font-medium block mb-1">
          Zoom URL <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input value={zoom} onChange={(e) => setZoom(e.target.value)} placeholder="https://ucsc.zoom.us/..."
          className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave({
            ...(days.trim() ? { days: days.trim() } : {}),
            ...(time.trim() ? { time: time.trim() } : {}),
            ...(location.trim() ? { location: location.trim() } : {}),
            zoomUrl: safeHttpUrl(zoom.trim()),
            source: "manual" as const,
          })}
          disabled={saving}
          className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Check size={13} />
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CourseDetailDrawer({
  course,
  onClose,
}: {
  course: CourseForDrawer;
  onClose: () => void;
}) {
  const extractOfficeHoursAction = useAction(api.canvas.extractOfficeHours);
  const updateOfficeHours = useMutation(api.courses.updateOfficeHours);
  const updateTaOfficeHours = useMutation(api.courses.updateTaOfficeHours);
  const updateSelectedTa = useMutation(api.courses.updateSelectedTa);
  const updateCourseCalendarSync = useMutation(api.courses.updateCourseCalendarSync);
  const logOfficeHoursViewed = useMutation(api.auditLog.logOfficeHoursViewed);

  const [taList, setTaList] = useState<TaEntry[]>(() => parseTas(course.tasJson));
  const [selectedTaEmail, setSelectedTaEmail] = useState<string | undefined>(course.selectedTaEmail);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(course.calendarSync ?? true);

  const hasExistingProfHours = !!parseOfficeHours(course.officeHours);
  const hasMissingTaHours = taList.some((ta) => !ta.officeHours);
  const shouldExtract = !hasExistingProfHours || hasMissingTaHours;

  const [displayData, setDisplayData] = useState<OfficeHoursData | null>(
    () => parseOfficeHours(course.officeHours)
  );
  const [extracting, setExtracting] = useState(shouldExtract);
  const [editingProf, setEditingProf] = useState(false);
  const [savingProf, setSavingProf] = useState(false);
  const [editingTaEmail, setEditingTaEmail] = useState<string | null>(null);
  const [savingTa, setSavingTa] = useState(false);
  const extractAttempted = useRef(false);

  // Log a view event when the drawer opens with already-cached office hours.
  // Extraction triggers its own server-side log, so we only log here for the cache-hit path.
  useEffect(() => {
    const hasCachedData =
      !!parseOfficeHours(course.officeHours) ||
      parseTas(course.tasJson).some((ta) => !!ta.officeHours);
    if (hasCachedData) {
      void logOfficeHoursViewed({ courseCode: course.courseCode, source: "drawer", found: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shouldExtract || extractAttempted.current) return;
    extractAttempted.current = true;

    const taNames = taList.map((ta) => ta.name);
    extractOfficeHoursAction({ courseId: course._id, canvasId: course.canvasId, courseCode: course.courseCode, taNames })
      .then(async (result) => {
        if (result.professor && !hasExistingProfHours) {
          await updateOfficeHours({ courseId: course._id, officeHours: result.professor });
          setDisplayData(parseOfficeHours(result.professor));
        }
        if (result.tas) {
          const extractedTas = JSON.parse(result.tas) as Array<{
            name: string; days?: string; time?: string; location?: string; zoomUrl?: string | null;
          }>;
          // Merge extracted hours into the TA list using course.tasJson as the base
          const baseTas = parseTas(course.tasJson);
          const merged = baseTas.map((ta) => {
            if (ta.officeHours) return ta; // already has hours, don't overwrite
            const found = extractedTas.find((e) => e.name === ta.name);
            if (!found) return ta;
            return {
              ...ta,
              officeHours: JSON.stringify({
                days: found.days, time: found.time,
                location: found.location, zoomUrl: found.zoomUrl ?? null,
                source: "auto" as const,
              }),
            };
          });
          const mergedJson = JSON.stringify(merged);
          await updateTaOfficeHours({ courseId: course._id, tasJson: mergedJson });
          setTaList(merged);
        }
      })
      .catch(() => { /* show empty states */ })
      .finally(() => setExtracting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfHours(data: OfficeHoursData) {
    setSavingProf(true);
    const json = JSON.stringify(data);
    await updateOfficeHours({ courseId: course._id, officeHours: json });
    setDisplayData(data);
    setSavingProf(false);
    setEditingProf(false);
  }

  async function saveTaHours(ta: TaEntry, data: OfficeHoursData) {
    setSavingTa(true);
    const updated = taList.map((t) =>
      t.name === ta.name ? { ...t, officeHours: JSON.stringify(data) } : t
    );
    await updateTaOfficeHours({ courseId: course._id, tasJson: JSON.stringify(updated) });
    setTaList(updated);
    setSavingTa(false);
    setEditingTaEmail(null);
  }

  async function selectTa(email: string | undefined) {
    setSelectedTaEmail(email);
    await updateSelectedTa({ courseId: course._id, selectedTaEmail: email });
  }

  const visibleTas = selectedTaEmail
    ? taList.filter((ta) => ta.email === selectedTaEmail)
    : taList;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={`${course.name} details`}
        className="fixed right-0 top-0 h-full w-96 max-w-full bg-white z-50 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="min-w-0">
            <span className="inline-block text-[11px] font-bold text-white bg-gray-700 rounded px-1.5 py-0.5">
              {course.courseCode}
            </span>
            <h2 className="mt-1.5 text-sm font-bold text-gray-900 leading-snug">{course.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Course Grade */}
          {(course.courseScore !== undefined || course.courseGrade !== undefined) && (
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Course Grade
              </h3>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1">
                <p className="text-sm font-semibold text-gray-800">
                  {course.courseScore !== undefined && (
                    <span>{course.courseScore}%</span>
                  )}
                  {course.courseScore !== undefined && course.courseGrade !== undefined && (
                    <span className="text-gray-400 mx-1">&middot;</span>
                  )}
                  {course.courseGrade !== undefined && (
                    <span>{course.courseGrade}</span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400 italic leading-relaxed">
                  Grade sourced directly from Canvas and may not reflect recent changes or your course syllabus.
                </p>
              </div>
            </section>
          )}

          {/* Calendar Sync */}
          <section>
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Calendar
            </h3>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CalendarBlank size={15} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Sync to Google Calendar</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {calendarSyncEnabled ? "Assignments synced to your calendar" : "Assignments not synced"}
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={calendarSyncEnabled}
                onClick={async () => {
                  const next = !calendarSyncEnabled;
                  setCalendarSyncEnabled(next);
                  await updateCourseCalendarSync({ courseId: course._id, enabled: next });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
                  calendarSyncEnabled ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    calendarSyncEnabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Instructor */}
          {(course.instructorName || course.instructorEmail) && (
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Instructor
              </h3>
              <div className="space-y-1">
                {course.instructorName && (
                  <p className="text-sm font-medium text-gray-800">{course.instructorName}</p>
                )}
                {course.instructorEmail && (
                  <a
                    href={`mailto:${course.instructorEmail}`}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                  >
                    <EnvelopeSimple size={13} />
                    {course.instructorEmail}
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Professor Office Hours */}
          <section>
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Professor Office Hours
            </h3>

            {extracting && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Robot size={15} className="text-blue-400 animate-pulse" />
                Searching course syllabus&hellip;
              </div>
            )}

            {!extracting && displayData && !editingProf && (
              <OfficeHoursDisplay data={displayData} onEdit={() => setEditingProf(true)} />
            )}

            {!extracting && !displayData && !editingProf && (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Office hours couldn&apos;t be automatically found on the course syllabus.
                    Add them manually so Nodegent AI can reference them.
                  </p>
                </div>
                <button
                  onClick={() => setEditingProf(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add office hours
                </button>
              </div>
            )}

            {editingProf && (
              <OfficeHoursForm
                initial={displayData}
                saving={savingProf}
                onSave={saveProfHours}
                onCancel={() => setEditingProf(false)}
              />
            )}
          </section>

          {/* TAs */}
          {taList.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Teaching Assistants
                </h3>
                {selectedTaEmail && (
                  <button
                    onClick={() => void selectTa(undefined)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Show all TAs
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {visibleTas.map((ta, idx) => {
                  const isSelected = ta.email === selectedTaEmail;
                  const taHours = parseOfficeHours(ta.officeHours);
                  const isEditingThis = editingTaEmail === (ta.email ?? ta.name);

                  return (
                    <div
                      key={ta.email ? ta.email : `${ta.name}-${idx}`}
                      className={`rounded-lg border p-3 space-y-2 ${
                        isSelected
                          ? "border-blue-200 bg-blue-50/40"
                          : "border-gray-100 bg-gray-50/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserCircle
                            size={16}
                            weight={isSelected ? "fill" : "regular"}
                            className={isSelected ? "text-blue-500 shrink-0" : "text-gray-400 shrink-0"}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{ta.name}</p>
                            {ta.email && (
                              <a
                                href={`mailto:${ta.email}`}
                                className="text-xs text-blue-600 hover:underline truncate block"
                              >
                                {ta.email}
                              </a>
                            )}
                          </div>
                        </div>
                        {!isSelected && ta.email && (
                          <button
                            onClick={() => void selectTa(ta.email)}
                            className="shrink-0 text-[11px] font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                          >
                            This is my TA
                          </button>
                        )}
                        {isSelected && (
                          <span className="shrink-0 text-[11px] font-semibold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">
                            My TA
                          </span>
                        )}
                      </div>

                      {/* TA office hours */}
                      {extracting && !taHours && (
                        <p className="text-xs text-gray-400 italic">Searching syllabus&hellip;</p>
                      )}

                      {!extracting && taHours && !isEditingThis && (
                        <OfficeHoursDisplay
                          data={taHours}
                          onEdit={() => setEditingTaEmail(ta.email ?? ta.name)}
                        />
                      )}

                      {!extracting && !taHours && !isEditingThis && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 leading-relaxed">
                            Office hours couldn&apos;t be auto-detected.
                          </p>
                          <button
                            onClick={() => setEditingTaEmail(ta.email ?? ta.name)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            + Add office hours
                          </button>
                        </div>
                      )}

                      {isEditingThis && (
                        <OfficeHoursForm
                          initial={taHours}
                          saving={savingTa}
                          onSave={(data) => saveTaHours(ta, data)}
                          onCancel={() => setEditingTaEmail(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
