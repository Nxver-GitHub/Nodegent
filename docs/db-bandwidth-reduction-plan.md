# Database Bandwidth Reduction Plan

**Status:** Proposed (not yet implemented)
**Date:** 2026-06-03
**Scope:** Convex backend (`convex/`) — reduce database bandwidth without changing user-facing functionality.

## Baseline (Convex dashboard, May 01 – Jun 01 2026, Dev)

Total: **1.31 GB**. Top consumers by Database Bandwidth:

| Function | Bandwidth |
|---|---|
| `assignments.getDailySnapshot` | 410.46 MB |
| `assignments.getUpcomingAssignments` | 398.49 MB |
| `courses.getCourseSummaries` | 324.83 MB |
| `chat.listMessages` | 58.13 MB |
| `assignments.getAssignments` | 56.77 MB |
| `assignments.getNewAssignments` | 18.58 MB |
| `auditLog.getAuditLog` | 15.4 MB |
| `courses.getCourses` | 12.15 MB |
| `assignments.upsertAssignment` | 9.62 MB |
| `canvas.getCanvasStatus` | 8.4 MB |
| `events.getEvents` | 3.65 MB |
| `events.getTodayEvents` | 3.4 MB |

The top three account for ~1.13 GB of the 1.31 GB total.

## How Convex bandwidth works (mental model)

- DB bandwidth = **bytes of documents read/written from the database**, summed over **every** execution.
- A reactive query re-reads its **entire** result set whenever any row it touched changes.
- Projecting fields in JS (`.map()` to a subset) does **NOT** reduce bandwidth — the full document is already read off disk.
- Convex counts a write **and fires reactivity even for no-op patches** (re-syncing identical data rewrites every row and re-triggers every subscribed query).

So the only levers are: (a) store fewer/smaller bytes per row, (b) read fewer rows, (c) re-execute less often.

## Root-cause findings

### 1. The `description` field is dead weight (biggest problem)
- `assignments.description` holds Canvas assignment HTML, often multiple KB per row.
- Written on every sync (`canvas.ts:509` → `upsertAssignment`) but **never read anywhere**:
  - Not in the dashboard UI (no `assignment.description` render — confirmed via grep across `src/`).
  - Not in calendar sync — `google-calendar.ts:169` builds its own description from `courseCode` + `htmlUrl`.
  - Not in chat context — `buildCampusContext` uses title/due/score, not description.
- Every `.collect()` in `getDailySnapshot`, `getUpcomingAssignments`, `getAssignments`, `getNewAssignments` drags this unused blob along on **every reactive re-run** → exactly the top consumers.

### 2. Reactive re-execution amplified by no-op writes
- During a Canvas sync the dashboard is typically open. Each `upsertAssignment` write invalidates the assignment queries → they re-read the full set.
- Each `recomputeCourseSummary` / `upsertCourse` patch invalidates `getCourseSummaries` → re-reads all course rows.
- `getCourseSummaries` reads the same rows as `getCourses` (12 MB) but bills **324 MB** — a 27× gap that is purely re-execution frequency, not row size.

### 3. `chat.listMessages` is unbounded
- `.collect()`s an entire thread (assistant replies up to 12 KB each via `clampText(..., 12_000)`), re-running on every new message.

## Decisions made

- **`description`:** Drop it entirely (it is never read). Not moving to an on-demand table — YAGNI.
- **`lastSyncedAt` in conditional-write checks:** Ignore it. Skip the row write when only `lastSyncedAt` would change. Trade-off accepted: `lastSyncedAt` won't refresh on no-op re-syncs.

## Phases (ordered by impact, each independently shippable)

### Phase 1 — Remove the unused `description` field (largest win, zero UX impact)
- Remove `description` from the `upsertAssignment` args (`convex/assignments.ts`) and stop passing it in `convex/canvas.ts:509`.
- Remove `description` from the `assignments` table in `convex/schema.ts`.
- Add an `internalMutation` migration that clears `description` on existing rows so the bytes are reclaimed immediately (not just on next sync).
- **Expected:** large reduction across `getDailySnapshot`, `getUpcomingAssignments`, `getAssignments`, `getNewAssignments`, and `upsertAssignment` writes. Plausibly the top two consumers drop by the majority of their size.

### Phase 2 — Make writes conditional (kills the re-execution multiplier)
- `recomputeCourseSummary` (`convex/courses.ts`): skip `ctx.db.patch` when `pendingCount` and `nextDueAt` are unchanged.
- `upsertAssignment` (`convex/assignments.ts`) and `upsertCourse` (`convex/courses.ts`): skip the patch when no meaningful field changed.
- Equality check **excludes `lastSyncedAt`** (otherwise it always differs and defeats the optimization).
- **Effect:** re-syncing unchanged data stops rewriting rows and stops invalidating `getCourseSummaries` and the assignment queries — directly attacks the 324 MB and the sync-time amplification of Phase-1 queries, plus trims the 9.6 MB write cost.

### Phase 3 — Bound `chat.listMessages`
- Switch from `.collect()` to a capped read (e.g. last 100 messages via `.order("desc").take(100)` then reverse), or paginate.
- **Effect:** caps the 58 MB consumer and prevents unbounded growth as threads age.

### Phase 4 (optional) — Course row trimming
- `getCourseSummaries` returns `tasJson` (used by UI) so the row can't shrink much; after Phase 2 this is mostly handled by reduced re-execution.
- Low priority — revisit only if it's still a top consumer after measuring.

## Risks & mitigations

- **MEDIUM — dropping `description` is hard to reverse once migrated.** Mitigation: confirmed unused via grep across `src/`, `convex/`, calendar lib, and chat context.
- **LOW — conditional-write equality checks** must compare all written fields or a real change gets skipped. Mitigation: compare exactly the fields each mutation patches; keep `lastSyncedAt` out of the equality check.
- **LOW — `listMessages` cap** could hide very old messages. A 100-message cap is well beyond a normal chat session.

## Validation (after each phase)

- Re-check the Convex dashboard "Database Bandwidth" breakdown over a comparable window.
- `npm run lint`
- `npm run build`
- `npm run test:e2e` (Playwright)
- Manual check: dashboard snapshot, assignment list, courses panel, and chat all render correctly.

## Complexity

LOW–MEDIUM. Phases 1–3 are small, surgical edits plus one migration. No architectural change.
