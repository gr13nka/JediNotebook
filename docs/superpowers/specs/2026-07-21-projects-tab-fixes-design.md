# Projects Tab Fixes — Design

**Date:** 2026-07-21
**Status:** Approved

## Problem

Nine defects and gaps reported against the Projects tab and its neighbours. Three
are cross-cutting (timer sync, vault freshness, Ideas section); the rest live in
the `/projects` and `/tasks` views.

## Design Principle

Most of the work is contained, local repair. Four genuinely new abstractions
carry the parts that would otherwise duplicate logic or leak across boundaries.
Everything else extends the module that already owns the concern.

### New modules

| Module | Interface | Hides |
|---|---|---|
| `client/src/utils/taskDnd.ts` | `setTextPayload`, `setTaskPayload`, `readPayload` | All `DataTransfer` MIME handling, source-range capture, and payload discrimination between the editor pane and the task pane |
| `client/src/hooks/useBackspaceGuard.ts` | `useBackspaceGuard()` | Document-level keydown listener and the editable-target test |
| `client/src/components/ui/InlineTextEdit.tsx` | `value`, `onCommit`, `className` | Focus-on-mount, caret-to-end, Enter/Escape/blur commit semantics |
| `IDEAS_FROZEN` in `shared/constants.ts` | one boolean | The four call sites that must agree on whether Ideas is frozen |

### Extended owners

- `stores/projectUIStore` — gains draft text (it already owns project-view UI state)
- `utils/time.ts` — gains negative clamping
- `stores/timerStore` — gains device scoping
- `vault/pollingWatcher.ts` — gains modification detection
- `vault/vaultStore.ts` — gains a reconcile heartbeat

---

## 1. Task draft survives tab switches

**Defect.** `ProjectTaskList` keeps the new-task title in local `useState`. The
parent `motion.div` in `ProjectsView` is keyed by `activeProject.id`, so
switching project remounts the subtree; switching route unmounts it outright.
Either way the typed text is discarded.

**Design.** Move the draft into `projectUIStore`:

```ts
taskDrafts: Record<string, string>          // projectId -> in-progress title
setTaskDraft(projectId: string, text: string): void
clearTaskDraft(projectId: string): void
```

`ProjectTaskList` reads `taskDrafts[projectId]` instead of local state and clears
it on successful create. The store is module-level Zustand, so the draft survives
both remount paths and dies on app reload — correct lifetime for a draft, and it
keeps transient text out of Dexie.

The `/tasks` quick-add bar in `TaskSelectionView` has the identical bug on route
change and gets the same treatment via a `quickAddDraft: string` field on the
same store.

**Not in scope.** Persisting drafts across app restarts.

## 2. Editor ⇄ task panel drag and drop

**Requirement.** On `/projects`, drag a text selection from the description
editor into the task panel to create a task, and drag a task row into the editor
to turn it back into text. Both panes are on screen simultaneously, so no
cross-route mechanism is needed.

**Payload contract** (`utils/taskDnd.ts`). Two custom MIME types alongside the
native `text/plain`, so native text drag still works elsewhere and foreign drags
are ignored:

```
application/x-jedi-text  -> { text, start, end }   // start/end are textarea offsets
application/x-jedi-task  -> { taskId, title }
```

`readPayload(e): { kind: 'text', ... } | { kind: 'task', ... } | null`

`effectAllowed` is set to `'copy'` on our payloads so no browser auto-deletes the
source text; every mutation is performed explicitly by our own handlers. This
keeps behavior identical across Chromium and WebKit webviews.

**Selection → task panel.** `dragstart` on the description textarea captures
`selectionStart`/`selectionEnd` and stamps `application/x-jedi-text`. On drop,
`ProjectTaskList` creates the task from the text and calls back to splice the
captured range out of the description. Holding ⌘/Ctrl at drop time copies instead
of moving.

**Task row → editor.** The row stamps `application/x-jedi-task`. On drop, the
editor inserts `title` at the caret resolved via `document.caretPositionFromPoint`
(falling back to `caretRangeFromPoint`, then to appending a trailing line), and
the task is soft-deleted through `useProjectTasks.deleteTask`.

**Constraint.** The selection → task direction is active only while the editor is
in edit mode (a real `<textarea>`). Only the textarea exposes exact character
offsets to cut from; the rendered preview cannot be mapped back to source offsets
reliably. Dragging from preview produces no drop highlight, which is honest
feedback rather than a silent partial behavior.

**Feedback.** Drop targets highlight only when `readPayload` returns a matching
kind, so it is visible before release whether a drag will take.

## 3. Text selection and Backspace in the project window

Two independent causes.

**Selection collapses on click.** `ProjectDraftEditor.handlePreviewClick` fires on
`click`, which is dispatched after a drag-select completes. It immediately enters
edit mode, which unmounts the preview and destroys the selection. Move the
handler to `mouseup` and enter edit mode only when
`window.getSelection()?.isCollapsed` is true.

**Backspace navigates back.** In the webview, Backspace outside an editable field
triggers history back — which the user perceives as "jumps to another tab".
`useBackspaceGuard`, mounted once in `App.tsx`, calls `preventDefault()` on
Backspace when `event.target` is not an `<input>`, `<textarea>`, or
`contenteditable` element.

The item-4 fix contributes here as well: collapsing the preview from N sibling
`<div>`s into one container stops selection from snapping to whole blocks.

## 4. Markdown render jitter

**Defect.** The preview wraps every line in `<div className="py-0.5">` and blank
lines in `<div className="h-6">`, while the textarea uses `lineHeight: 1.625`
with no per-line padding. The two boxes therefore have different heights, and
text shifts vertically on every transition between them.

**Design.** One shared typography box used by both branches:

```ts
const EDITOR_BOX = 'w-full text-sm leading-relaxed whitespace-pre-wrap';
```

The preview becomes a single container with `<br>`-separated rendered lines;
blank lines render as `&nbsp;` inside that same box. No per-line padding, no
fixed-height spacer divs. Font-size, line-height, padding, and width are then
identical in both modes, making the swap pixel-stable.

Markdown rendering is retained.

## 5. Timer count wrong across devices

Reported symptom: phone shows `20:00`, PC shows `-36:-32` for the same timer.
Three defects compose to produce it.

1. **`timerStore.restore()` adopts any running entry.** It filters only on
   `endedAt === null && !deletedAt`, so an entry synced from another device is
   adopted as this device's running timer.
   **Fix:** additionally require `e.deviceId === getDeviceId()`.
   Timers become device-local; a phone-started timer is never adopted by the PC.

2. **`formatDuration` renders negatives as garbage.** `pad()` uses
   `padStart(2, '0')`, which leaves `-36` and `-32` untouched, producing
   `-36:-32`. Any clock skew between devices surfaces as nonsense.
   **Fix:** clamp at zero in both `formatDuration` and `formatDurationLong`.

3. **Negative durations at the source.** `timerStore.stop()` computes
   `durationSeconds` from wall-clock subtraction and can persist a negative value;
   `timer.worker.ts` can emit a negative elapsed.
   **Fix:** clamp at zero in both places, so a bad value is never stored or
   broadcast — not merely hidden at render time.

## 6. Editing tasks on the task selection tab

`SelectableTaskRow` has no rename affordance. `TaskItem` already implements the
full inline-edit interaction (focus on mount, caret to end, Enter commits, Escape
reverts, blur commits, empty-value revert) inline in the component.

Extract that into `ui/InlineTextEdit.tsx`, refactor `TaskItem` onto it, and give
`SelectableTaskRow` the same control — triggered by double-click and by a new
"Rename" entry in its existing `ContextMenu`. Writes go through
`useProjectTasks.updateTask`.

This is the "leave it better than you found it" step: one interaction, one
implementation, two consumers.

## 7. Remove the `0/10` badges

- `ProjectTaskList` header: `{incompleteTasks.length}/{maxTasks}` → bare
  incomplete count.
- `ProjectsView` mobile grid: `{counts.done}/{counts.total} tasks` → bare task
  count.

The `maxTasks` limit itself is unchanged and still gates `canAdd`; the existing
`InfoTooltip` already explains it. Other `N/M` displays in the app (habits,
review, pomodoro presets) are unrelated and stay.

## 8. Vault content freshness

**Defect.** Android falls back to `PollingWatcher`, which

- polls every **30 s**, and
- **cannot detect modifications at all** — `scanDir` stores a constant `1` per
  path, so only create and delete are ever reported. A file edited in place by an
  external sync tool never propagates.

**Design.**

- `PollingWatcher.scanDir` records real `mtime` via `stat` from
  `@tauri-apps/plugin-fs`; `poll()` compares mtimes and emits `modify` events for
  changed paths.
- Default interval drops from 30 s to 5 s.
- `vaultStore` adds a 60 s `syncNow()` reconcile heartbeat as a safety net for
  anything the watcher misses, cleared in `disable()` alongside the existing
  watcher and visibility handler.

Intervals live as named constants in one place. The desktop native watcher path
is untouched.

## 9. Freeze the Ideas section

**Root cause of the reported title loss.** `serializeNote` writes to
`notes/${entityFilename(n.title || 'Untitled', n.id)}.md` — the title is part of
the *filename*. Renaming a note writes a new file and orphans the old one, so the
vault accumulates stale copies which later re-import over the current row. This
is why titles revert to `Untitled` and notes eventually vanish.

**Scope of the freeze (read-only, still visible).** Gated on `IDEAS_FROZEN`:

- `NotesPage` — banner explaining Ideas is paused
- `NoteEditor` — all inputs disabled
- `NoteList` — no create button, no delete/context actions
- `vaultSync` — notes skipped on **export and import**, in `exportAllToDisk`,
  `importAllFromDisk`, the per-entity write path, and `handleExternalChange`

No note rows are deleted and no vault files are removed. Flipping `IDEAS_FROZEN`
to `false` restores the section exactly as it was.

**Not in scope.** Fixing the filename-carries-title design. That is the real
repair and belongs in its own change; the freeze buys time without data loss.

---

## Verification

No test framework is configured in this repo. Verification is:

```bash
cd client && npx tsc --noEmit
cd client && npm run build
```

plus manual exercise of each of the nine behaviors, and — for item 5 and item 8 —
a two-device check against the Android build.

## Risks

- **Caret-from-point on drop** is engine-dependent. Mitigated by an explicit
  fallback chain ending in append-at-end.
- **5 s Android polling** increases battery and I/O on large vaults. Mitigated by
  the fact that `poll()` only stats, and only emits when something changed.
- **Device-local timers** are a behavior change: a timer started on the phone will
  no longer appear on the PC. This was chosen deliberately over cross-device
  continuation, which lets two devices fight over one entry.
