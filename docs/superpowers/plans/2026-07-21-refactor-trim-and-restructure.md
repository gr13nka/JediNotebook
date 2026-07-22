# JediNotebook — Major Refactoring Plan

> **Source material.** Phases 3 and 4 implement findings from the Software Design Lenses
> audit, archived alongside this plan at
> [`docs/superpowers/specs/2026-07-21-lens-audit-findings.yaml`](../specs/2026-07-21-lens-audit-findings.yaml)
> (6 critical, 27 major, 12 minor, 12 info). Findings are referenced below by their
> description rather than by index; search that file for the quoted `location:` paths.
>
> Companion documents: [`2026-07-21-projects-tab-fixes.md`](./2026-07-21-projects-tab-fixes.md)
> and its [design spec](../specs/2026-07-21-projects-tab-fixes-design.md) cover the nine
> bug fixes on `fix/projects-tab-overhaul`, which this plan assumes are merged first.

## Context

Two things prompted this. First, after shipping nine bug fixes today, you looked at the
feature surface and concluded much of it isn't needed. Second, a Software Design Lenses
audit found **6 critical and 27 major** design findings, dominated by *change
amplification*: five cross-cutting decisions (vault file layout, the persisted-record
envelope, the settings roster, the theme registry, the nav route registry) are each
re-stated in 3–25 places, so routine changes require coordinated edits across many files
and a miss fails silently rather than at compile time.

Both halves point the same direction, and they compose: **deleting the unneeded features
removes a large fraction of the audit's findings for free, and makes the remaining
refactors substantially cheaper.** That is the organising principle of this plan — cut
first, then restructure what's left.

The stack itself is not implicated. Nothing in the audit or in today's nine bugs was
caused by React, Vite, Dexie, Zustand or Tauri. No rewrite is proposed.

**Intended outcome:** roughly 6,000 lines removed, the five leaking decisions each given a
single owner, and a test harness so this kind of work can be verified without a phone in
hand.

---

## Prerequisite

Branch `fix/projects-tab-overhaul` (12 commits, today's nine fixes) is **unmerged and
untested in a real app**. Test and merge it before starting, so that if a bug surfaces
later it is not tangled with a 6,000-line deletion. This plan's branch
(`refactor/trim-features`) is currently based on it.

---

## Phase 1 — Delete unneeded features

Mechanical and independently revertable. Each item is one commit: remove components,
hooks, stores, workers, routes, nav entries, settings fields, vault serializers and
translation keys for that feature.

| # | Feature | Approx. lines | Notes |
|---|---|---:|---|
| 1.1 | REST sync | 136 | **Already dead code** — `SyncSettings` is imported by nothing and was never mounted in `SettingsPage`. Also deletes `server/`, `Dockerfile`, `docker-compose.yml`. |
| 1.2 | Review page | 208 | Leaf: route + nav only |
| 1.3 | Fatigue check | 170 | Leaf: `HomePage` entry points only |
| 1.4 | Timer notifications | ~60 | `useTimer` notification block + settings section |
| 1.5 | Procrastination checker | ~250 | `utils/procrastinationCheck.ts`, `ProcrastinationConfirmModal`, settings section, call sites in `TaskItem` + `SelectableTaskRow` |
| 1.6 | PDF documents | 483 | Also drops the `react-pdf` dependency and a **1,046 kB** `pdf.worker` bundle chunk |
| 1.7 | Notes / Ideas | 627 | Removes the `IDEAS_FROZEN` flag added today and the unresolved title bug with it |
| 1.8 | Task Timer | 263 | Removes `timerStore` contention entirely once Pomodoro is also gone |
| 1.9 | Pomodoro | 867 | Store, worker, presets, `HomePage` modal |
| 1.10 | Habits | 802 | Route, weekly tracker, `useHabits` |
| 1.11 | Mind Maps | 1,846 | Largest single feature |
| 1.12 | Gamification / XP | 177 | Do **after** 1.7–1.11 — four of the ten `awardXP` call sites are in files deleted above |
| 1.13 | Themes → light, dark, custom | ~250 | Drop 8 prebuilt palettes from `index.css`, `ThemeMode`, `settingsStore.applyTheme`, `useThemeColors`, `ThemeToggle` |
| 1.14 | Languages → `en`, `ru` | ~1,290 | Do **last** — every step above deletes keys |

**Order matters.** Features first, then gamification (fewer surviving `awardXP` sites),
then i18n (so we aren't editing translation blocks about to be deleted).

**Data safety.** Leave every Dexie table *declared* in `client/src/db/index.ts` and leave
existing vault files on disk. Nothing you have written is destroyed and each cut is
reversible. Tables can be dropped later in a single schema bump once you're confident.

### Audit findings this phase closes for free

| Finding | Severity | Closed by |
|---|---|---|
| `useHabits` bypasses `getLogicalDate` — habits disagree with every other feature at the day boundary | **critical** | 1.10 |
| `timerStore.stop()` silently awards XP as a hidden side effect | major | 1.12 |
| `TodayTaskCard` has 14 props, 8 of them relayed task-timer state | major | 1.8 |
| `taskTimerStore` shallow module + `pauseTask`/`resumeTask` pass-throughs | minor | 1.8 |
| `activeTaskId` actually holds a `TodayTask` id | major | 1.8 |
| `deleteHabit` doesn't cascade to `habitEntries` | major | 1.10 |
| Worker contract asymmetry undocumented (`pomodoro.worker` reused by task timer) | major | 1.8 + 1.9 |
| `IDEAS_FROZEN` names a feature the data layer calls `Note` | major | 1.7 |
| `syncEngine.syncNow` undocumented contract | minor | 1.1 |
| Settings roster restated in server `CREATE TABLE` + `INSERT` + `CASE WHEN` | part of **critical** | 1.1 |

It also shrinks the two biggest remaining refactors before they start: `serializers.ts`
drops from 24 exported functions to ~10, and `vaultSync`'s three 14-way fan-outs become
~7-way.

---

## Phase 2 — Test harness (do before Phase 3)

Phase 3 restructures load-bearing code. Today there is **no test framework**, which is why
every one of the nine fixes shipped with "manual check NOT PERFORMED", why the plan
contained four wrong expected values, and why the vault changes have had zero runtime
execution. Refactoring the record envelope and vault layout without tests is not
defensible.

Scope is deliberately narrow — **pure logic only, no UI tests**:

- Add `vitest` to `client/`, one `npm run test` script.
- `client/src/utils/taskDnd.ts` — `cutRange`, `insertLine`, `wholeLineRange`,
  `offsetAfterLine`. Already has verified expected values from today's work.
- `client/src/utils/time.ts` — `formatDuration` clamping, `getLogicalDate` boundary
  behaviour across `dayStartHour`.
- `client/src/utils/recurrence.ts` — `shouldCreateRecurrence`, `getNextOccurrenceDate`.
- **`client/src/vault/serializers.ts` — round-trip tests** (`serialize → deserialize →
  deep-equal`) for every surviving entity kind. This is the highest-value item in the
  plan: it is the test that would have caught the notes data-loss class without a device,
  and it is the safety net Phase 3.1 needs.

---

## Phase 3 — Give the leaking decisions a single owner

The audit's four surviving criticals. Each is independently shippable; do them in this
order because later ones are easier once earlier ones land.

### 3.1 Vault layout registry — *critical*

**Problem:** which directory an entity lives in, its filename shape, and its Dexie table
are encoded independently in six places: `serializers.ts` (literal paths in each
`serialize*`), `vaultSync.exportAllToDisk` (hardcoded `mkdir` list), `importAllFromDisk`
(hardcoded scan list), `writeEntityToDisk` (switch), `handleExternalChange`
(`filePath.startsWith(...)` chain), `tableFromPath` (same prefixes again), plus
`dexieHooks.ts`'s `TABLE_TO_TYPE`. Adding or renaming one kind means seven coordinated
edits; a miss yields silent one-way sync.

**Approach:** one `client/src/vault/vaultLayout.ts` owning a registry keyed by entity
kind — `{ table, dir, buildPath(entity), matchPath(path) }` — and have all seven sites
derive from it. Reuse `entityFilename()` / `extractShortIdFromFilename()` in
`vault/sanitize.ts`, which already own filename encoding correctly.

Pair with the uniform serializer shape (major): every kind exposes
`toFiles(entity, children) → VaultFile[]` and `fromFiles(files) → {entity, children}`,
replacing today's five mutually incompatible return shapes. That is what lets
`exportAllToDisk` / `importAllFromDisk` / `writeEntityToDisk` become loops instead of
hand-written per-type branches.

Also fold in: `deserializeProject` currently returns a `Project` with `name: ''` and a
comment saying the caller fills it from the directory name — change the signature to
`deserializeProject(dirName, content)` and decode inside.

### 3.2 Record envelope + soft-delete repository — *critical*

**Problem:** `{ id: generateId(), createdAt, updatedAt, deletedAt: null, deviceId:
getDeviceId() }` is hand-assembled at ~25 sites; `.filter(x => !x.deletedAt)` is repeated
in every hook and leaks into components (`InboxView`, `TaskSelectionView`,
`ProjectsView`). Nothing enforces either: a forgotten filter silently resurrects deleted
rows, a forgotten `updatedAt` silently breaks LWW sync.

**Approach:** a repository layer over Dexie — `newRecord<T>(fields)`, `liveTable(name)`,
`softDelete(table, id)` — that stamps the envelope and applies the filter *by
construction*. Route all surviving hooks, stores and components through it.

This also collapses the **12-hook CRUD classitis** (major): `useActivities`, `useNotes`,
`useInbox`, `useFolders`, `useProjects` etc. are the same five lines with the table
swapped. One `useEntity<T>(table)` plus genuinely entity-specific extras replaces them.

**Cascade rules belong here too.** `TaskSelectionView.tsx:478-485` reimplements
`useProjectTasks.deleteTask`'s cascade *without its transaction*, and a second path at
`:549` has no cascade at all, orphaning `todayTasks`. Both should call the hook. (The same
class of duplication was found and fixed in `ProjectsView` during today's work — this is
the remaining instance.)

### 3.3 Settings single owner — *critical*

**Problem:** the field roster is enumerated five times — `SettingsState` (~41 fields),
`load()`'s hand-written `raw.X ?? DEFAULT_SETTINGS.X` ladder (one line per field),
`DEFAULT_SETTINGS`, `shared/types.ts`'s drifted `UserSettings` subset, and (until Phase
1.1) the server's three SQL restatements. Forgetting the `load()` line makes a setting
silently revert to default on every reload — a live bug class.

**Approach:** one module declares the schema; derive `SettingsState`, `UserSettings` and
defaults from it. Replace the `??` ladder with `{ ...DEFAULT_SETTINGS, ...saved }` plus
explicit migrations for the two legacy cases only (`darkMode` boolean, `'notion'` theme).
Phase 1 deletes roughly a dozen fields first, so do this after.

### 3.4 Split the settings god-store — *critical*

`SettingsState` exposes 41 flat fields read field-by-field by ~40 components; the
interface *is* the representation, and `update()` carries three hidden DOM side effects
(`applyTheme`, `applyAccentColor`, `applyZoom`) plus it mutates the caller's patch object
in place.

Split into cohesive modules with intention-revealing operations: a theme module behind
`setTheme()` / `isDark()`, a nav-layout module behind `hideTab()` / `reorderTabs()`.
Define each surviving theme **once** as a data object (id, label key, 12 colour tokens,
dark flag) in a single `themes.ts`, and generate the CSS properties, the Recharts palette
and the `ThemeToggle` swatches from it — today each theme's hexes are written three times.
Have `useIsDark()` read `settingsStore.theme` instead of sniffing `<html>`'s class list.
Phase 1.13 cuts this from 11 themes to 3 first.

---

## Phase 4 — Cheap cleanups

Low risk, high readability. Batch into one or two commits.

> **Findings from Phase 2's tests (2026-07-22)** — five genuine bugs pinned (not fixed) by
> the new suites; the first three fold into the Phase 4 items below:
> 1. `getLogicalDate` mixes local `getHours()` with UTC `toISOString()` — east of UTC the
>    returned date can shift an extra day (verified: UTC+3, `2026-01-01 01:00` local with
>    `dayStartHour 6` → `'2025-12-30'`, expected `'2025-12-31'`). Fix in the Phase 4
>    logical-date item: serialize from local date components, not `toISOString()`.
> 2. Weekly recurrence ignores `daysOfWeek` entirely (`recurrence.ts:9-11`) — next
>    occurrence is always same-weekday + interval·7d. Fold into the recurrence unification.
> 3. Monthly recurrence overflows before the `dayOfMonth` clamp (`recurrence.ts:12-17`) —
>    `dayOfMonth: 31` from Jan 31 lands on Mar 31, silently skipping February.
> 4. Activity with empty name round-trips via vault as `'Untitled'` (heading-based name
>    extraction). Minor; normalize during Phase 3.1's uniform serializer shape.
> 5. `serializeFolders` writes `deletedAt` to disk, unlike every other serializer.
>    Normalize during Phase 3.1.

- **Logical-date consistency:** `useAnalytics.ts:115` computes `today` as a plain calendar
  date and compares it against `timeEntries.date`, which holds *logical* dates — streaks
  can read as broken near a day boundary. Route through `getLogicalDate(dayStartHour)`.
  (The `useHabits` instance of this bug disappears with Phase 1.10.) **Also make
  `getLogicalDate` timezone-safe (finding 1 above).**
- **Dual recurrence mechanisms:** `useProjectTasks.toggleTask` creates the next occurrence
  immediately on completion, gated only by a title dedup; `useRecurringTaskCheck` independently
  re-scans on mount and on `visibilitychange`, gated by `shouldCreateRecurrence()`'s real
  interval math. Neither references the other. Route `toggleTask` through the same gate.
- **Extract the reorder protocol:** the same five-prop drag contract is re-declared in
  `TaskItem`, `SelectableTaskRow` and `TaskGroupCard`, with the hit-test and index maths
  copied into each parent. Extract one `useReorderList({items, onReorder})`. `utils/taskDnd.ts`
  — which the audit singles out as the best-shaped module in the codebase — is the model.
- **`platform.ts`:** five exported ways to ask one question, where `isAndroidTauri()`
  silently degrades to the UA sniff the module itself documents as unreliable. Collapse to
  one memoised `getPlatform()` plus `usePlatform()`.
- **`useAllProjectTasks`** runs two independent live queries over the same data and returns
  two shapes; build one and derive the other.
- **Naming:** `usePointsCounter` → staleness vocabulary (it is an age² *penalty*, while the
  app's real reward system is `awardXP`); `TaskGroup.tasks` → `incompleteTasks`;
  `serializeTimeLog` → `serializeTimeEntries`; `deserializeTasks` → `deserializeProjectTasks`;
  delete the dead unqualified `THEME` constant in `shared/constants.ts`.
- **Missing interface docs** on: `VaultBackend` (the one abstraction a new platform backend
  must implement — including that `writeFile` creates parent directories), `clearAllTables` /
  `restoreFromSnapshot` (hard, irreversible, the only exception to the no-hard-deletes rule),
  `mergeEntity` (why `deletedAt` is deliberately discarded), and each surviving `deleteX`'s
  cascade behaviour.
- **`writeQueue.getCoalesceKey`** carries a seven-line comment promising parent-key coalescing
  followed by an admission it doesn't do it. Either implement it or correct the comment.

---

## Verification

No test framework exists until Phase 2; verification differs by phase.

**Every commit, all phases:**
```bash
cd client && npx tsc --noEmit     # must print no errors
cd client && npm run build        # must end "✓ built in ..."
```
Note `client/tsconfig.json` sets `"noUnusedLocals": false`, so **tsc will not flag dead
code left behind by a deletion**. After each Phase 1 removal, grep for the removed
symbols by hand.

**Phase 2 onward:**
```bash
cd client && npm run test
```

**Phase 1 smoke test** — after the deletions, in `npm run dev`: every surviving route
loads (`/`, `/projects`, `/tasks`, `/today`, `/inbox`, `/analytics`, `/settings`); no nav
entry points at a deleted route; the settings page renders with no missing sections;
switching language between English and Russian shows no missing-key fallbacks.

**Phase 3 vault verification** — the highest-risk area, and the reason Phase 2's
round-trip tests matter. Beyond those:
```bash
cd client && npm run tauri:build
rm -rf /Applications/JediNotebook.app && \
  ditto client/src-tauri/target/release/bundle/macos/JediNotebook.app /Applications/JediNotebook.app
```
Then, against a **copy** of a real vault: enable it, confirm entities import; edit a file
externally and confirm the change lands; rename an entity and confirm exactly one file
exists for it afterwards (no orphan) — this is the failure mode behind the notes bug.

**Android** must be checked separately for anything touching `vault/` — it is the only
platform using `PollingWatcher`:
```bash
cd client && npx tauri android build --apk --debug
adb install -r client/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

---

## Sequencing summary

```
merge + test fix/projects-tab-overhaul
  └─ Phase 1  delete features        ~6,000 lines out, closes 10 audit findings
       └─ Phase 2  vitest harness    enables safe restructuring
            └─ Phase 3  4 criticals  vault layout → repository → settings → store split
                 └─ Phase 4  cleanups
```

Phases 1, 2 and 4 are low risk. Phase 3 is where the real design change happens, and it is
deliberately placed after the deletions (which shrink it) and after the tests (which make
it verifiable).

---

# Addendum (2026-07-22) — Roadmap amendments and Phase 5

Decided with the user before execution started. The prerequisite was resolved by
**merging `fix/projects-tab-overhaul` to main untested** (fast-forward to `0958ae4`) as a
checkpoint; testing happens together with the trim. Scope was extended: this effort now
ends with **Phase 5, the time-box feature** (today/week/later flags on tasks), designed
below. The roadmap behind it: tasks live in one of three boxes; the week box is flipped
through daily to promote a few tasks to today; incomplete today-tasks fall back to week
at the day boundary; a task can optionally be pinned to a date, but that is not the
default workflow.

## Adjustments to Phases 1–4

- **Phase 1:** additionally delete the dead, never-mounted `client/src/hooks/useDayBoundary.ts`
  (zero import sites). The current `/review` page is confirmed *not* to be the
  Singularity-style review the user wants later — 1.2 stands.
- **Phase 2:** additionally generalize `getLogicalDate(dayStartHour, reference: Date = new Date())`
  (backward compatible) and cover the new parameter in the `time.ts` tests — Phase 5's
  migration classifier and Phase 4's `useAnalytics` fix both need it. Do not pre-write
  rollover/migration tests; that code arrives in Phase 5.
- **Phase 3.1:** the `todayTasks` registry entry stays as generic infrastructure — no
  special-casing for its coming retirement.
- **Phase 3.2:** do not invest in porting `useTodayTasks` onto `useEntity<T>` (Phase 5
  deletes it whole). Still fix the `TaskSelectionView` cascade duplication (live bug).
  Leave the `db.todayTasks` cascade branches in `useProjectTasks.deleteTask` /
  `useProjects.deleteProject` — Phase 5 strips them once the table is retired.
- **Phase 4:** recurrence unification must land before Phase 5's recurrence-spawn edit
  (already true in phase order). Phase 5's box views are a drop-in consumer of
  `useReorderList`.

## Phase 5 — Time-box feature (after Phase 4)

### Data model (Dexie v10)

```ts
// shared/types.ts
type TimeBox = 'today' | 'week' | 'later';
interface ProjectTask {
  // ...existing...
  timeBox: TimeBox;
  scheduledDate: string | null; // optional pin to a logical date — not the default workflow
  timeBoxOrder: number;         // manual order within the current box
}
```

- Schema v10: `projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt, timeBox, scheduledDate'`
  (indexed — box views query `where('timeBox')`). `timeBoxOrder` unindexed, sorted in JS
  like the existing `sortOrder` patterns. A separate `timeBoxOrder` (not reusing
  `sortOrder`, which owns per-project order) avoids "two decisions, one field" leakage.
- **Migration rule** (pure function `classifyTimeBoxForMigration`, unit-tested):
  incomplete + referenced by a non-deleted `TodayTask` row for the current logical date
  → `'today'`; other incomplete → `'later'` (no data distinguishes "week" intent — don't
  invent it); completed with `completedAt` on today's logical date → `'today'`; other
  completed → `'later'`. `scheduledDate: null` everywhere. Assign `timeBoxOrder`
  iterating tasks pre-sorted by `(projectId, sortOrder)`.
- **The same upgrade transaction must stamp `settings.lastRolloverDate = today`** —
  otherwise the rollover hook fires on first launch and immediately demotes everything
  the migration just classified into `'today'`.

### Rollover (auto-demote at logical day change)

New `useTaskRollover()` mounted at App root beside `useRecurringTaskCheck()` — fires on
mount + `visibilitychange` (the app's proven pattern; not `useDayBoundary`'s interval,
which misses OS-suspended timers on mobile). New settings field
`lastRolloverDate: string | null` via Phase 3.3's schema.

Pure function `computeRollover({today, lastRolloverDate, tasks}) → {toWeek[], toLater[], toToday[]}`:

1. Idempotency guard: `lastRolloverDate === today` → no-op.
2. Demote everything in `'today'`: **incomplete → `'week'`; completed → `'later'`**
   (consistent with the migration rule — the daily-flipped week box never accumulates
   done-task clutter). This is also how the today view stays clean: rollover empties the
   box; the view never date-filters.
3. Promote: `scheduledDate !== null && scheduledDate <= today && !isCompleted` →
   `'today'`, **clearing `scheduledDate`** (without the clear, a still-incomplete task
   ping-pongs between demotion and re-promotion and can never leave `'today'`). `<=`
   catches pins missed while the app was closed.
4. Demote before promote, so a both-eligible task nets into `'today'`.
5. Stamp `lastRolloverDate = today` unconditionally; apply in one
   `db.transaction('rw', [projectTasks, settings])`. Rerunning is a fixed point.

**Recurrence interaction:** the next occurrence spawns into the completed task's
`timeBox`, with `scheduledDate: null` and `timeBoxOrder` appended — a two-field addition
to Phase 4's unified recurrence function. Rollover and recurrence stay fully decoupled.

### Views (smallest change satisfying the workflow)

- **`/today` (`TodayPage`)**: same shape (incomplete/completed split, focus mode),
  re-sourced from `useTaskBox('today')`. Keeps chevron reorder for now.
- **`/tasks` (`TaskSelectionView`)**: a box-tab row `Today | Week | Later | All` layered
  on the existing grouped/flat + sort controls (grouped view already *is* project
  filtering). **Default tab: `Week`** — the daily flip-through-and-promote habit.
  Client-side filter over `useAllProjectTasks`'s existing arrays; no new live query.
- Replace the `toggleToday`/`isInToday` pill with `moveToBox(taskId, box)` rendered as a
  single contextual button ("→ Today" / "→ Week"), matching the one-tap promote workflow.
- New `hooks/useTaskBox.ts`: live query on the `timeBox` index, sorted by `timeBoxOrder`,
  project-enriched, exposes `moveToBox` / `reorderBox` / `toggleComplete`. Build on
  Phase 3.2's repository if it fits naturally; don't force-fit.
- `useTodayTasks.ts` deleted. `App.tsx` mounts `useTaskRollover()`.

### Vault

- Single touch point after Phase 3.1: the project kind's `toFiles`/`fromFiles` task
  mapping gains `timeBox` + `scheduledDate` (+ `timeBoxOrder`), with forward-compat
  deserialize defaults (`timeBox: t.timeBox || 'later'`, `scheduledDate || null`).
  Extend Phase 2's round-trip test: all three box values, set/null `scheduledDate`.
- `today/<date>.md` machinery: untouched (data-safety rule). All write paths to
  `db.todayTasks` disappear, so the Dexie-hook subscription stops firing; no new files
  are written; existing ones stay on disk. Cosmetic leftover (empty `today/` mkdir in
  new vaults) noted for the eventual table-drop schema bump.

### Phase 5 task breakdown (one commit each)

| # | Task | Tests |
|---|---|---|
| 5.1 | `TimeBox` type + 3 fields on `ProjectTask` in `shared/types.ts` | — |
| 5.2 | Fix all construction sites tsc flags (`useProjectTasks.createTask`, recurrence spawn, `TaskSelectionView` inline create, `db/seed.ts`) with defaults `timeBox:'later'`, `scheduledDate:null`, appended `timeBoxOrder` | — |
| 5.3 | `classifyTimeBoxForMigration()` pure fn | **unit** |
| 5.4 | Dexie v10 upgrade: indexes, classifier per task, stamp `lastRolloverDate` | manual |
| 5.5 | `computeRollover()` pure fn (idempotent no-op, incomplete→week, completed→later, promote+clear `scheduledDate`, demote-before-promote, multi-day gap = one transition) | **unit — highest value** |
| 5.6 | `useTaskRollover()` hook, mount in `App.tsx` | manual |
| 5.7 | Recurrence spawn inherits `timeBox`, resets `scheduledDate` (in Phase 4's unified fn) | extend |
| 5.8 | `useTaskBox(box)` hook; delete `useTodayTasks.ts` | — |
| 5.9 | `TodayPage` → `useTaskBox('today')` | manual |
| 5.10a | `TaskSelectionView`: box tabs + client-side filter (default Week) | — |
| 5.10b | Swap `toggleToday`/`isInToday` → `moveToBox`/current-box across `TaskSelectionView`/`TaskGroupCard`/`SelectableTaskRow` | manual |
| 5.11 | Strip dead `db.todayTasks` cascades from `useProjectTasks.deleteTask` / `useProjects.deleteProject`; grep-verify only `vault/` + `db/index.ts` still reference `db.todayTasks` | — |
| 5.12 | Vault serializer fields + round-trip test extension | **unit** |
| 5.13 (opt) | Surface `scheduledDate` in the human-readable checklist body | — |

### Phase 5 verification

Run dev with a copy of real data → v10 migration puts today's picked tasks in Today,
nothing lost; flip the logical date (adjust `dayStartHour` or the system clock) →
incomplete today-tasks appear in Week, completed land in Later, `scheduledDate`
promotion fires exactly once; the `/tasks` Week tab's promote button moves a task to
Today instantly; the vault's `tasks.md` shows the new fields after an edit; no new
`today/<date>.md` files appear.

## Deferred roadmap (recorded, not in this effort)

- **Singularity-style review** of projects/tasks — a new design cycle on the cleaned
  codebase; the deleted `/review` page is unrelated to it.
- **Inbox auto-sort suggestions** (project/time keywords in captured text → suggest a
  target). Groundwork laid here: `moveToBox()` plus Phase 3.2 routing inbox's three
  inline `ProjectTask`-creation sites through one function make this a pure
  matching-util + suggestion-UI feature later.
- **Date-pinning UI** beyond the raw `scheduledDate` field (the field + promotion logic
  ship in Phase 5; a picker UI can come with the review feature).
