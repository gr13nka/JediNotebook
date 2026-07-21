# Projects Tab Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix nine reported defects across the Projects tab, the Tasks tab, timer sync, vault freshness, and the Ideas section.

**Architecture:** Four new small modules carry concerns that would otherwise be duplicated (`utils/taskDnd.ts`, `hooks/useBackspaceGuard.ts`, `ui/InlineTextEdit.tsx`, an `IDEAS_FROZEN` flag). Everything else extends the module that already owns the concern: `projectUIStore` gains draft text, `utils/time.ts` gains clamping, `timerStore` gains device scoping, `PollingWatcher` gains modification detection.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, Zustand 5, Dexie 4, Motion, Tauri v2 (`@tauri-apps/plugin-fs` 2.4.5).

**Spec:** `docs/superpowers/specs/2026-07-21-projects-tab-fixes-design.md`

---

## Testing note — read before starting

**This repository has no test framework and no linter configured.** That is a
documented property of the project (see `CLAUDE.md`), not an oversight to fix in
this plan. Introducing Vitest here would be unrequested scope.

Every task therefore verifies with this exact pair, run from the repo root:

```bash
cd client && npx tsc --noEmit
cd client && npm run build
```

`tsc --noEmit` must print **no output** (success). `npm run build` must end with
`✓ built in <time>`.

Where a change is a pure function, the task additionally includes a **throwaway**
node check that produces real evidence. These are run inline and **not
committed** — they are there so you never claim a behavior works without having
observed it.

Each task also lists a **manual check**. Run the dev server once at the start and
leave it running:

```bash
cd client && npm run dev     # http://localhost:5173
```

Do not mark a task complete on the strength of the code alone. Run the checks.

---

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `client/src/utils/taskDnd.ts` | The drag payload contract between the project editor pane and the task pane. Owns all `DataTransfer` MIME handling. |
| `client/src/hooks/useBackspaceGuard.ts` | App-wide suppression of Backspace history-navigation outside editable fields. |
| `client/src/components/ui/InlineTextEdit.tsx` | Click-to-edit single-line text control. One implementation, two consumers. |

**Modified files**

| Path | Change |
|---|---|
| `client/src/utils/time.ts` | Clamp negative durations |
| `client/src/workers/timer.worker.ts` | Clamp negative elapsed |
| `client/src/stores/timerStore.ts` | Device-scoped restore; clamp stored duration |
| `client/src/App.tsx` | Mount `useBackspaceGuard` |
| `client/src/components/projects/ProjectTaskList.tsx` | Draft from store; drop target; bare count |
| `client/src/components/projects/ProjectsView.tsx` | Bare task count in mobile grid |
| `client/src/components/projects/ProjectDraftEditor.tsx` | Grid-stacked editor; metric parity; selection-safe click; drag source and drop target |
| `client/src/components/projects/TaskItem.tsx` | Refactor onto `InlineTextEdit`; drag source |
| `client/src/components/taskSelection/TaskSelectionView.tsx` | Quick-add draft from store |
| `client/src/components/taskSelection/SelectableTaskRow.tsx` | Inline rename |
| `client/src/components/taskSelection/TaskGroupCard.tsx` | Pass rename handler through |
| `client/src/stores/projectUIStore.ts` | `taskDrafts`, `quickAddDraft` |
| `client/src/vault/pollingWatcher.ts` | mtime-based modify detection; faster interval |
| `client/src/vault/vaultStore.ts` | Reconcile heartbeat |
| `client/src/vault/vaultSync.ts` | Skip notes in both directions when frozen |
| `client/src/components/notes/NoteList.tsx` | Frozen banner; no create; read-only cards |
| `client/src/components/notes/NoteEditor.tsx` | Disable inputs when frozen |
| `shared/constants.ts` | `IDEAS_FROZEN` |
| `client/src/i18n/translations.ts` | New keys in all 5 languages |

**Task order.** Tasks 1–4 are independent and low-risk. Task 6 depends on Task 5
(it wires into the editor structure Task 5 creates). Tasks 7–9 are independent.

---

## Task 1: Timer durations can never be negative

Reported symptom: phone shows `20:00`, PC shows `-36:-32` for the same timer.
Three defects compose. This task fixes all three: display, source, and the
cross-device adoption that exposes them.

**Files:**
- Modify: `client/src/utils/time.ts:1-21`
- Modify: `client/src/workers/timer.worker.ts:11-18`
- Modify: `client/src/stores/timerStore.ts:55-102`

- [ ] **Step 1: Observe the defect in the current pure function**

Run this from the repo root. It exercises the *current* `formatDuration` logic
verbatim so you see the real broken output before changing anything:

```bash
node -e '
const pad = (n) => n.toString().padStart(2, "0");
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
console.log("negative:", formatDuration(-2192));
console.log("zero:    ", formatDuration(0));
console.log("normal:  ", formatDuration(1200));
'
```

Expected output — note the reported symptom reproduces exactly:

```
negative: -36:-32
zero:     0:00
normal:   20:00
```

- [ ] **Step 2: Clamp in `utils/time.ts`**

Replace lines 1–21 of `client/src/utils/time.ts` with:

```ts
// Durations are clamped at zero. Clock skew between synced devices can make a
// naive `now - startedAt` go negative, and padStart() leaves the minus sign in
// place — which surfaced as "-36:-32" on screen.
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

export function formatDurationLong(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
```

- [ ] **Step 3: Verify the clamp with the same throwaway check**

```bash
node -e '
const pad = (n) => n.toString().padStart(2, "0");
function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
console.log("negative:", formatDuration(-2192));
console.log("zero:    ", formatDuration(0));
console.log("normal:  ", formatDuration(1200));
console.log("hours:   ", formatDuration(3725));
'
```

Expected — the negative case now reads `0:00` and nothing else regressed:

```
negative: 0:00
zero:     0:00
normal:   20:00
hours:    1:02:05
```

- [ ] **Step 4: Clamp the elapsed the worker broadcasts**

In `client/src/workers/timer.worker.ts`, replace the body of the `start` branch
(lines 7–19) with:

```ts
  if (type === 'start') {
    startTime = new Date(startedAt).getTime();
    if (intervalId) clearInterval(intervalId);

    // Clamped at zero: a startedAt written by a device whose clock runs ahead
    // would otherwise broadcast a negative elapsed to the whole app.
    const currentElapsed = () =>
      Math.max(0, Math.floor((Date.now() - startTime) / 1000));

    intervalId = setInterval(() => {
      self.postMessage({ type: 'tick', elapsed: currentElapsed() });
    }, 1000);

    // Immediately send current elapsed
    self.postMessage({ type: 'tick', elapsed: currentElapsed() });
  }
```

- [ ] **Step 5: Scope timer restore to this device and clamp the stored duration**

In `client/src/stores/timerStore.ts`, add `getDeviceId` to the existing import on
line 4 — it already imports `generateId`, so the line becomes:

```ts
import { generateId, getDeviceId } from '../utils/uuid';
```

(That import is already exactly this — confirm it, do not duplicate it.)

Then replace the `stop` function (lines 55–78) with:

```ts
  stop: async () => {
    const state = get();
    if (!state.activeEntryId || !state.startedAt) return;

    const now = new Date();
    const startedAt = new Date(state.startedAt);
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - startedAt.getTime()) / 1000),
    );

    await db.timeEntries.update(state.activeEntryId, {
      endedAt: now.toISOString(),
      durationSeconds,
      updatedAt: now.toISOString(),
    });

    if (durationSeconds >= 60) awardXP(XP_VALUES.stopTimer);

    set({
      activeEntryId: null,
      activeActivityId: null,
      startedAt: null,
      elapsed: 0,
      isRunning: false,
    });
  },
```

And replace the `restore` function (lines 84–102) with:

```ts
  restore: async () => {
    // Only resume a timer this device started. A running entry synced from
    // another device is deliberately ignored: adopting it made two devices
    // share one entry, and any clock skew between them rendered as a negative
    // elapsed time.
    const deviceId = getDeviceId();
    const running = await db.timeEntries
      .filter((e) => e.endedAt === null && !e.deletedAt && e.deviceId === deviceId)
      .first();

    if (running) {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000),
      );
      set({
        activeEntryId: running.id,
        activeActivityId: running.activityId,
        startedAt: running.startedAt,
        elapsed,
        isRunning: true,
      });
    }
  },
```

- [ ] **Step 6: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: `tsc` prints nothing; build ends with `✓ built in <time>`.

- [ ] **Step 7: Manual check**

In the running dev app: start a timer on an activity, confirm it counts up from
`0:00`. Reload the page mid-run and confirm the timer resumes with the correct
elapsed (not zero, not negative). Stop it and confirm the recorded duration on
the activity card is positive.

- [ ] **Step 8: Commit**

```bash
git add client/src/utils/time.ts client/src/workers/timer.worker.ts client/src/stores/timerStore.ts
git commit -m "fix(timer): device-scoped restore and non-negative durations

restore() adopted any running entry, so a timer started on the phone was
picked up by the desktop; clock skew between the two then produced a
negative elapsed which formatDuration rendered as '-36:-32'. Scope restore
to this device's deviceId and clamp durations at zero in the worker, the
store, and the formatters."
```

---

## Task 2: Backspace stops navigating back

Reported symptom: pressing Backspace with text selected in the project window
"jumps to other tab". In the webview, Backspace outside an editable field
triggers history back.

**Files:**
- Create: `client/src/hooks/useBackspaceGuard.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create the hook**

Create `client/src/hooks/useBackspaceGuard.ts`:

```ts
import { useEffect } from 'react';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    // Buttons and checkboxes rendered as <input> do not consume Backspace.
    const type = (target as HTMLInputElement).type;
    return !['button', 'submit', 'reset', 'checkbox', 'radio'].includes(type);
  }
  return false;
}

/**
 * Suppresses the webview's Backspace-navigates-back behavior.
 *
 * In a Tauri webview, Backspace pressed outside a text field walks the history
 * stack, which reads to the user as the app randomly switching tabs. Text
 * fields keep their normal behavior.
 *
 * Mount once, at the app root.
 */
export function useBackspaceGuard(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return;
      if (isEditable(e.target)) return;
      e.preventDefault();
    };
    // Capture phase: run before any component handler can let it through.
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, []);
}
```

- [ ] **Step 2: Mount it at the app root**

In `client/src/App.tsx`, add to the imports after line 17
(`import { useRecurringTaskCheck } ...`):

```ts
import { useBackspaceGuard } from './hooks/useBackspaceGuard';
```

Then, immediately after the existing `useRecurringTaskCheck();` call on line 48,
add:

```ts
  useBackspaceGuard();
```

- [ ] **Step 3: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds.

- [ ] **Step 4: Manual check**

Open `/projects`, click on the rendered description text (not into a field), and
press Backspace. Expected: nothing happens — the app stays on `/projects`. Then
click into the task-title input, type some text, and press Backspace. Expected:
the character is deleted normally.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useBackspaceGuard.ts client/src/App.tsx
git commit -m "fix(nav): stop Backspace from navigating back in the webview

Backspace outside a text field walked the history stack, which read as the
app jumping to another tab. Guard it app-wide in the capture phase; text
fields are unaffected."
```

---

## Task 3: Remove the `0/10` badges

Show a plain task count instead of `count/limit`. The `maxTasksPerProject` limit
itself is unchanged and still gates whether the add row appears; the existing
`InfoTooltip` already explains it.

**Files:**
- Modify: `client/src/components/projects/ProjectTaskList.tsx:93-95`
- Modify: `client/src/components/projects/ProjectsView.tsx:733-737`

- [ ] **Step 1: Bare count in the task panel header**

In `client/src/components/projects/ProjectTaskList.tsx`, replace lines 93–95:

```tsx
        <span className="text-xs text-text-muted">
          {incompleteTasks.length}/{maxTasks}
        </span>
```

with:

```tsx
        <span className="text-xs text-text-muted tabular-nums">
          {incompleteTasks.length}
        </span>
```

Leave the `maxTasks` binding on line 18 and the `canAdd` check on line 25 alone —
the limit still applies, it is only no longer displayed.

- [ ] **Step 2: Bare count in the mobile project grid**

In `client/src/components/projects/ProjectsView.tsx`, replace lines 733–737:

```tsx
                          {counts && (
                            <span className="text-[11px] text-text-muted">
                              {counts.done}/{counts.total} tasks
                            </span>
                          )}
```

with:

```tsx
                          {counts && (
                            <span className="text-[11px] text-text-muted tabular-nums">
                              {counts.total}
                            </span>
                          )}
```

- [ ] **Step 3: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds. `maxTasks` is still referenced by
`canAdd`, so no unused-variable error.

- [ ] **Step 4: Manual check**

On `/projects` desktop, the task panel header shows a single number. Narrow the
window below 768px with mobile grid enabled and confirm project cards show a
single number rather than `0/3 tasks`. Confirm adding tasks past the configured
limit still hides the add row.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/projects/ProjectTaskList.tsx client/src/components/projects/ProjectsView.tsx
git commit -m "fix(projects): show a plain task count instead of count/limit

The limit still applies and is still explained by the info tooltip; only
the 0/10 style badge is gone."
```

---

## Task 4: Task drafts survive tab and route switches

Reported symptom: text typed into the add-task field is discarded if you switch
tabs before pressing Enter. `ProjectTaskList` holds the title in local `useState`,
and the parent `motion.div` in `ProjectsView` is keyed by `activeProject.id`, so
switching project remounts the subtree and switching route unmounts it.

**Files:**
- Modify: `client/src/stores/projectUIStore.ts`
- Modify: `client/src/components/projects/ProjectTaskList.tsx:19,27-33,120-127`
- Modify: `client/src/components/taskSelection/TaskSelectionView.tsx:52,272-284,392-393,421`

- [ ] **Step 1: Add draft state to the project UI store**

In `client/src/stores/projectUIStore.ts`, add these four members to the
`ProjectUIState` interface, after `mobileSheetHeight: number | null;` (line 10):

```ts
  /** In-progress add-task text, keyed by project id. Survives tab remounts. */
  taskDrafts: Record<string, string>;
  /** In-progress text in the /tasks quick-add bar. */
  quickAddDraft: string;
  setTaskDraft: (projectId: string, text: string) => void;
  clearTaskDraft: (projectId: string) => void;
  setQuickAddDraft: (text: string) => void;
```

Then add the implementations to the store body, after
`mobileSheetHeight: null,` (line 25):

```ts
  taskDrafts: {},
  quickAddDraft: '',
  setTaskDraft: (projectId, text) =>
    set((s) => ({ taskDrafts: { ...s.taskDrafts, [projectId]: text } })),
  clearTaskDraft: (projectId) =>
    set((s) => {
      const next = { ...s.taskDrafts };
      delete next[projectId];
      return { taskDrafts: next };
    }),
  setQuickAddDraft: (text) => set({ quickAddDraft: text }),
```

- [ ] **Step 2: Read the draft from the store in `ProjectTaskList`**

In `client/src/components/projects/ProjectTaskList.tsx`, add the store import
after line 4 (`import { useSettingsStore } ...`):

```ts
import { useProjectUIStore } from '../../stores/projectUIStore';
```

Replace line 19:

```tsx
  const [newTitle, setNewTitle] = useState('');
```

with:

```tsx
  const newTitle = useProjectUIStore((s) => s.taskDrafts[projectId] ?? '');
  const setTaskDraft = useProjectUIStore((s) => s.setTaskDraft);
  const clearTaskDraft = useProjectUIStore((s) => s.clearTaskDraft);
  const setNewTitle = (text: string) => setTaskDraft(projectId, text);
```

Replace `handleAdd` (lines 27–33) with:

```tsx
  const handleAdd = async () => {
    if (!newTitle.trim() || !canAdd) return;
    await createTask(newTitle.trim(), newTaskRule);
    clearTaskDraft(projectId);
    setNewTaskRule(null);
    setShowNewRecurrence(false);
  };
```

The `<input>` on lines 120–127 needs no change — `value={newTitle}` and
`onChange={(e) => setNewTitle(e.target.value)}` now read and write the store.

- [ ] **Step 3: Do the same for the `/tasks` quick-add bar**

In `client/src/components/taskSelection/TaskSelectionView.tsx`, add the import
after line 8 (`import { useSettingsStore } ...`):

```ts
import { useProjectUIStore } from '../../stores/projectUIStore';
```

Replace line 52:

```tsx
  const [newTaskTitle, setNewTaskTitle] = useState('');
```

with:

```tsx
  const newTaskTitle = useProjectUIStore((s) => s.quickAddDraft);
  const setNewTaskTitle = useProjectUIStore((s) => s.setQuickAddDraft);
```

In `handleAddTask`, the existing `setNewTaskTitle('')` on line 273 now clears the
store — no change needed there. Same for line 283 (`Escape` handler) and line 421
(the `×` button). All three already call `setNewTaskTitle('')`.

- [ ] **Step 4: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds. If `tsc` reports `useState` is
declared but never read in either file, remove `useState` from that file's React
import only if it has no other uses — `ProjectTaskList` still uses it for
`newTaskRule` and `showNewRecurrence`, and `TaskSelectionView` still uses it
extensively, so both should keep the import.

- [ ] **Step 5: Manual check**

On `/projects`: type a partial task title into the add field, switch to another
project tab, switch back. Expected: the text is still there. Type again, navigate
to `/today`, navigate back to `/projects`. Expected: still there. Press Enter and
confirm the task is created and the field clears.

On `/tasks`: open the quick-add bar, type a partial title, navigate away and
back. Expected: text preserved.

- [ ] **Step 6: Commit**

```bash
git add client/src/stores/projectUIStore.ts client/src/components/projects/ProjectTaskList.tsx client/src/components/taskSelection/TaskSelectionView.tsx
git commit -m "fix(projects): keep in-progress task text across tab switches

The add-task field held its text in local state under a subtree keyed by
project id, so switching project or route discarded it. Drafts now live in
projectUIStore, which already owns project-view UI state and outlives both
remount paths."
```

---

## Task 5: Stable editor — no jitter, selection survives

Two defects in `ProjectDraftEditor`, fixed together because both come from the
preview and the textarea being swapped in and out of the same slot.

1. **Jitter.** The preview wraps each line in `py-0.5` and blank lines in `h-6`,
   while the textarea uses `lineHeight: 1.625` with no per-line padding. The two
   boxes have different heights, so content shifts on every transition.
2. **Selection collapses.** `handlePreviewClick` fires on `click`, dispatched
   after a drag-select completes. It enters edit mode, unmounting the preview and
   destroying the selection — which is why selecting text "selects all" and then
   loses it.

**Approach.** Stack the preview and the textarea in a single CSS grid cell so
both are always mounted and the container height is `max(preview, textarea)`.
Toggling between them then changes no layout at all — jitter becomes structurally
impossible rather than merely tuned away. On top of that, give both the same
typography so ordinary lines sit at the same y-offset.

**Files:**
- Modify: `client/src/components/projects/ProjectDraftEditor.tsx:20-96,164-189`

- [ ] **Step 1: Replace the editor state and handlers**

In `client/src/components/projects/ProjectDraftEditor.tsx`, replace lines 20–96
(from `export function ProjectDraftEditor(` down to and including
`const { t } = useTranslation();`) with:

```tsx
// Shared typography for the description box. The preview and the textarea must
// resolve to identical line boxes, otherwise text shifts when they swap.
const EDITOR_TEXT = 'text-sm leading-relaxed';

export function ProjectDraftEditor({ title, description, color, icon, onSaveProject, onSave, linkedActivityId, onLinkActivity, activities }: ProjectDraftEditorProps) {
  const [localDesc, setLocalDesc] = useState(description);
  const [isEditing, setIsEditing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    setLocalDesc(description);
  }, [description]);

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, []);

  // Keep the textarea sized to its content at all times — not just while
  // editing. It shares a grid cell with the preview, so its height is part of
  // what holds the container steady across mode switches.
  useEffect(() => {
    autoResize();
  }, [localDesc, autoResize]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalDesc(e.target.value);
    autoResize();
  };

  const handleDescBlur = () => {
    setIsEditing(false);
    if (localDesc !== description) {
      onSave(localDesc);
    }
  };

  // Enter edit mode on mouse-up, and only when nothing is selected. Using
  // `click` here meant a drag-select immediately entered edit mode and threw
  // the selection away.
  const handleContainerMouseUp = () => {
    if (isEditing) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    setIsEditing(true);
  };

  const hasContent = localDesc.trim().length > 0;

  // One <div> per source line, each exactly one line box tall — matching how the
  // textarea lays the same text out. Blank lines render as a non-breaking space
  // rather than a fixed-height spacer.
  const renderPreview = () =>
    localDesc.split('\n').map((line, i) => (
      <div
        key={i}
        className="markdown-preview"
        dangerouslySetInnerHTML={{
          __html: line.trim() === '' ? '&nbsp;' : renderLineMd(line),
        }}
      />
    ));

  const nonBreakActivities = activities?.filter((a) => !a.isBreak) ?? [];
```

Note the `const { t } = useTranslation();` has moved to the top of the component
with the other hooks; make sure it does not remain duplicated further down.

- [ ] **Step 2: Replace the editor box markup with a grid stack**

In the same file, replace the description box block (originally lines 164–189,
the `<div className="mx-auto w-full max-w-prose">` wrapper and everything inside
it) with:

```tsx
      <div className="mx-auto w-full max-w-prose">
        {/* Preview and textarea occupy the SAME grid cell, so the container is
            as tall as the taller of the two and switching modes moves nothing. */}
        <div
          ref={containerRef}
          onMouseUp={handleContainerMouseUp}
          className="grid rounded-xl p-4 text-text-primary cursor-text overflow-y-auto no-scrollbar"
          style={{ boxShadow: NEU.pressedSm, minHeight: '300px' }}
        >
          <div
            style={{ gridArea: '1 / 1' }}
            className={`${EDITOR_TEXT} min-w-0 ${isEditing ? 'invisible' : ''}`}
          >
            {hasContent ? (
              renderPreview()
            ) : (
              <span className="text-text-muted/40">{t('projects.notePlaceholder')}</span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={localDesc}
            onChange={handleDescChange}
            onBlur={handleDescBlur}
            style={{ gridArea: '1 / 1' }}
            className={`${EDITOR_TEXT} w-full min-w-0 bg-transparent text-text-primary focus:outline-none border-none resize-none overflow-hidden whitespace-pre-wrap selection:bg-accent/30 selection:text-text-primary ${
              isEditing ? '' : 'invisible pointer-events-none'
            }`}
          />
        </div>
      </div>
```

- [ ] **Step 3: Add the placeholder translation key**

The hardcoded English string `"Take a note..."` is replaced above by
`t('projects.notePlaceholder')`. In `client/src/i18n/translations.ts`, add this
key to **all five** language blocks. Find the existing `'projects.'` keys in each
block and add alongside them:

```ts
  // en
  'projects.notePlaceholder': 'Take a note...',
  // zh
  'projects.notePlaceholder': '记点什么...',
  // es
  'projects.notePlaceholder': 'Escribe una nota...',
  // pt
  'projects.notePlaceholder': 'Escreva uma nota...',
  // ru
  'projects.notePlaceholder': 'Заметка...',
```

`TranslationKey` is derived from `keyof typeof en`, so adding the key to `en`
makes `tsc` require it in the other four. If `tsc` reports a missing key in a
block, that block was missed.

- [ ] **Step 4: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds.

- [ ] **Step 5: Manual check — this is the important one**

On `/projects`, in the description box:

1. Type several lines of plain text including a blank line between paragraphs.
   Click outside to render, click back in to edit. **Expected: the text does not
   move vertically at all** between the two states.
2. Drag-select a phrase in the rendered preview. **Expected: the selection stays
   highlighted and the box does not flip into edit mode.**
3. Click once on empty space in the box. **Expected: it enters edit mode.**
4. Type a `# Heading` line. Toggling modes will move the lines *below* the
   heading, because a rendered heading is genuinely taller than its source line.
   The container itself must not jump. See the note below.

**Known and intentional:** heading lines render larger than their plain-text
source, so content below a heading sits lower in preview than in edit mode. The
container no longer jumps, and non-heading content is now pixel-stable. If you
want zero movement for headings too, the follow-up is to render headings at the
base font size with weight only — flag this to the user rather than doing it
unasked.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/projects/ProjectDraftEditor.tsx client/src/i18n/translations.ts
git commit -m "fix(projects): stop the description box from jumping on edit

Preview and textarea now share one grid cell, so the container height is
max(preview, textarea) and switching modes changes no layout. Both use the
same typography, and click-to-edit moved to mouseup guarded on an empty
selection so drag-selecting text no longer throws the selection away."
```

---

## Task 6: Drag between the editor and the task panel

**Depends on Task 5** — it wires into the grid-stacked editor created there.

Two directions, both **move** semantics as specified:

- **Selection → task panel:** the selected text becomes a task and is cut out of
  the description. Holding ⌘/Ctrl at drop time copies instead.
- **Task row → editor:** the title is inserted at the drop point and the task is
  soft-deleted.

**Files:**
- Create: `client/src/utils/taskDnd.ts`
- Modify: `client/src/components/projects/ProjectDraftEditor.tsx`
- Modify: `client/src/components/projects/ProjectTaskList.tsx`
- Modify: `client/src/components/projects/TaskItem.tsx`

- [ ] **Step 1: Create the drag payload module**

Create `client/src/utils/taskDnd.ts`:

```ts
/**
 * The drag contract between the project description editor and the task panel.
 *
 * Custom MIME types are used so foreign drags (a file, a link, text from another
 * app) are ignored rather than silently turned into tasks. `effectAllowed` is
 * always 'copy': the browser must never mutate the drag source itself, because
 * every move in this feature is performed explicitly by our own handlers, and
 * engines disagree about when a 'move' effect deletes source text.
 */

const TEXT_MIME = 'application/x-jedi-text';
const TASK_MIME = 'application/x-jedi-task';

export interface TextPayload {
  kind: 'text';
  text: string;
  /** Offsets into the textarea's value, so the exact range can be cut out. */
  start: number;
  end: number;
}

export interface TaskPayload {
  kind: 'task';
  taskId: string;
  title: string;
}

export type DragPayload = TextPayload | TaskPayload;

export function setTextPayload(
  e: React.DragEvent,
  text: string,
  start: number,
  end: number,
): void {
  e.dataTransfer.setData(TEXT_MIME, JSON.stringify({ text, start, end }));
  e.dataTransfer.setData('text/plain', text);
  e.dataTransfer.effectAllowed = 'copy';
}

export function setTaskPayload(e: React.DragEvent, taskId: string, title: string): void {
  e.dataTransfer.setData(TASK_MIME, JSON.stringify({ taskId, title }));
  e.dataTransfer.setData('text/plain', title);
  e.dataTransfer.effectAllowed = 'copy';
}

/**
 * Reads a payload on drop. Returns null for anything we did not originate.
 *
 * Note: only `types` is readable during dragover — the data itself is not. Use
 * `hasPayload` for hover feedback and this for the drop itself.
 */
export function readPayload(e: React.DragEvent): DragPayload | null {
  const rawText = e.dataTransfer.getData(TEXT_MIME);
  if (rawText) {
    try {
      const { text, start, end } = JSON.parse(rawText);
      return { kind: 'text', text, start, end };
    } catch {
      return null;
    }
  }
  const rawTask = e.dataTransfer.getData(TASK_MIME);
  if (rawTask) {
    try {
      const { taskId, title } = JSON.parse(rawTask);
      return { kind: 'task', taskId, title };
    } catch {
      return null;
    }
  }
  return null;
}

/** Whether a drag in progress carries the given payload kind. Safe during dragover. */
export function hasPayload(e: React.DragEvent, kind: 'text' | 'task'): boolean {
  const mime = kind === 'text' ? TEXT_MIME : TASK_MIME;
  return Array.from(e.dataTransfer.types).includes(mime);
}

/** True when the user asked to copy rather than move (⌘ on macOS, Ctrl elsewhere). */
export function isCopyModifier(e: React.DragEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

/**
 * Resolves a character offset in `textarea` from a drop point.
 * Falls back to the end of the text when the engine does not support
 * caret-from-point (WebKit coverage is uneven).
 */
export function caretOffsetFromPoint(
  textarea: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos && textarea.contains(pos.offsetNode)) return pos.offset;
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range && textarea.contains(range.startContainer)) return range.startOffset;
  }
  return textarea.value.length;
}

/** Removes [start, end) from `text`, collapsing the blank line it may leave behind. */
export function cutRange(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const joined = before + after;
  // A whole line dragged out leaves "\n\n" where there was one line; collapse it
  // so the description does not accumulate blank lines.
  if (before.endsWith('\n') && after.startsWith('\n')) {
    return before + after.slice(1);
  }
  return joined;
}

/** Inserts `line` into `text` at `offset` as its own line. */
export function insertLine(text: string, offset: number, line: string): string {
  const at = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const prefix = before === '' || before.endsWith('\n') ? '' : '\n';
  const suffix = after === '' || after.startsWith('\n') ? '' : '\n';
  return before + prefix + line + suffix + after;
}
```

- [ ] **Step 2: Verify the two pure string helpers**

These carry the actual data mutation, so check them before wiring any UI:

```bash
node -e '
function cutRange(text, start, end) {
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (before.endsWith("\n") && after.startsWith("\n")) return before + after.slice(1);
  return before + after;
}
function insertLine(text, offset, line) {
  const at = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const prefix = before === "" || before.endsWith("\n") ? "" : "\n";
  const suffix = after === "" || after.startsWith("\n") ? "" : "\n";
  return before + prefix + line + suffix + after;
}
const doc = "alpha\nbravo\ncharlie";
console.log("cut middle word:", JSON.stringify(cutRange(doc, 6, 11)));
console.log("cut whole line: ", JSON.stringify(cutRange(doc, 6, 12)));
console.log("insert at 0:    ", JSON.stringify(insertLine(doc, 0, "zero")));
console.log("insert mid-line:", JSON.stringify(insertLine(doc, 8, "mid")));
console.log("insert at end:  ", JSON.stringify(insertLine(doc, doc.length, "omega")));
'
```

Expected:

```
cut middle word: "alpha\n\ncharlie"
cut whole line:  "alpha\ncharlie"
insert at 0:     "zero\nalpha\nbravo\ncharlie"
insert mid-line: "alpha\nb\nmid\nravo\ncharlie"
insert at end:   "alpha\nbravo\ncharlie\nomega"
```

If any line differs, fix `taskDnd.ts` before continuing — every drag in this
feature routes through these two functions.

- [ ] **Step 3: Make the textarea a drag source and a drop target**

In `client/src/components/projects/ProjectDraftEditor.tsx`, add the import:

```ts
import {
  setTextPayload,
  readPayload,
  hasPayload,
  isCopyModifier,
  caretOffsetFromPoint,
  cutRange,
  insertLine,
} from '../../utils/taskDnd';
```

Add a new prop to `ProjectDraftEditorProps` (the interface at lines 8–18):

```ts
  /** Called when a task row is dropped into the description. */
  onConsumeTask?: (taskId: string) => void;
```

and accept it in the destructured parameter list alongside `activities`.

Add these handlers inside the component, after `handleContainerMouseUp`:

```tsx
  const [isTaskDropTarget, setIsTaskDropTarget] = useState(false);

  // Drag OUT: stamp the exact selected range so the drop side can cut it.
  const handleTextDragStart = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart === selectionEnd) {
      e.preventDefault();
      return;
    }
    setTextPayload(e, ta.value.slice(selectionStart, selectionEnd), selectionStart, selectionEnd);
  };

  /**
   * Cut a range that the task panel has just turned into a task.
   *
   * `localDescRef` rather than `localDesc` so this callback stays stable and
   * does not re-register on every keystroke, and so the save happens outside a
   * state updater — React may invoke updaters twice under StrictMode, which
   * would double-save.
   */
  const localDescRef = useRef(localDesc);
  useEffect(() => {
    localDescRef.current = localDesc;
  }, [localDesc]);

  const cutRangeFromDescription = useCallback((start: number, end: number) => {
    const next = cutRange(localDescRef.current, start, end);
    localDescRef.current = next;
    setLocalDesc(next);
    onSave(next);
  }, [onSave]);

  // Drag IN: a task row becomes a line of description.
  const handleEditorDragOver = (e: React.DragEvent) => {
    if (!hasPayload(e, 'task')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsTaskDropTarget(true);
  };

  const handleEditorDragLeave = () => setIsTaskDropTarget(false);

  const handleEditorDrop = (e: React.DragEvent) => {
    setIsTaskDropTarget(false);
    const payload = readPayload(e);
    if (!payload || payload.kind !== 'task') return;
    e.preventDefault();

    const ta = textareaRef.current;
    const offset = ta ? caretOffsetFromPoint(ta, e.clientX, e.clientY) : localDesc.length;
    const next = insertLine(localDesc, offset, payload.title);
    setLocalDesc(next);
    onSave(next);
    onConsumeTask?.(payload.taskId);
  };
```

Expose the cut function to the parent by adding another prop to
`ProjectDraftEditorProps`:

```ts
  /** Registers the range-cutter so the task panel can remove dragged-out text. */
  onRegisterCut?: (cut: (start: number, end: number) => void) => void;
```

and, inside the component:

```tsx
  useEffect(() => {
    onRegisterCut?.(cutRangeFromDescription);
  }, [onRegisterCut, cutRangeFromDescription]);
```

Wire the handlers onto the container `<div>` created in Task 5 — add to its
existing props:

```tsx
          onDragOver={handleEditorDragOver}
          onDragLeave={handleEditorDragLeave}
          onDrop={handleEditorDrop}
```

and add a ring while a task hovers it, by appending to that div's `className`:

```tsx
${isTaskDropTarget ? 'ring-2 ring-accent' : ''}
```

Add to the `<textarea>`:

```tsx
            draggable
            onDragStart={handleTextDragStart}
```

- [ ] **Step 4: Make the task panel a drop target for text**

In `client/src/components/projects/ProjectTaskList.tsx`, extend the props
interface (lines 11–13):

```ts
interface ProjectTaskListProps {
  projectId: string;
  /** Removes [start, end) from the description after text becomes a task. */
  onCutDescriptionRange?: (start: number, end: number) => void;
}
```

and the signature on line 15:

```tsx
export function ProjectTaskList({ projectId, onCutDescriptionRange }: ProjectTaskListProps) {
```

Add the import:

```ts
import { readPayload, hasPayload, isCopyModifier, setTaskPayload } from '../../utils/taskDnd';
```

Add these handlers next to the existing drag handlers:

```tsx
  const [isTextDropTarget, setIsTextDropTarget] = useState(false);

  const handleTextDragOver = (e: React.DragEvent) => {
    if (!hasPayload(e, 'text') || !canAdd) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsTextDropTarget(true);
  };

  const handleTextDragLeave = () => setIsTextDropTarget(false);

  const handleTextDrop = async (e: React.DragEvent) => {
    setIsTextDropTarget(false);
    const payload = readPayload(e);
    if (!payload || payload.kind !== 'text' || !canAdd) return;
    e.preventDefault();

    // One task per non-empty line, so dragging a multi-line block unloads the
    // whole block rather than creating one task with embedded newlines.
    const lines = payload.text
      .split('\n')
      .map((l) => l.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    for (const line of lines) {
      await createTask(line, null);
    }
    if (!isCopyModifier(e)) {
      onCutDescriptionRange?.(payload.start, payload.end);
    }
  };
```

Wrap the outer `<div className="flex flex-col">` (line 88) with these props:

```tsx
    <div
      className={`flex flex-col rounded-xl transition-shadow ${
        isTextDropTarget ? 'ring-2 ring-accent' : ''
      }`}
      onDragOver={handleTextDragOver}
      onDragLeave={handleTextDragLeave}
      onDrop={handleTextDrop}
    >
```

- [ ] **Step 5: Make task rows a drag source**

`TaskItem` is already `draggable` for reordering, and its `onDragStart` is
supplied by the parent. Extend the parent's handler rather than the child, so
reordering keeps working.

In `ProjectTaskList.tsx`, replace `handleDragStart` (lines 45–48) with:

```tsx
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIdx.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Also advertise the task payload so the description editor can accept it.
    const task = incompleteTasks[index];
    if (task) setTaskPayload(e, task.id, task.title);
  };
```

Note `setTaskPayload` sets `effectAllowed = 'copy'`; that is intentional and
still permits the existing reorder drop, which reads `dragIdx` rather than the
dataTransfer.

- [ ] **Step 6: Connect the two panes in `ProjectsView`**

In `client/src/components/projects/ProjectsView.tsx`, add near the other refs
(around line 104):

```tsx
  const cutDescriptionRef = useRef<((start: number, end: number) => void) | null>(null);
  const registerCut = useCallback((cut: (start: number, end: number) => void) => {
    cutDescriptionRef.current = cut;
  }, []);
  const cutDescriptionRange = useCallback((start: number, end: number) => {
    cutDescriptionRef.current?.(start, end);
  }, []);
```

Add the task-consumer, which soft-deletes a task dropped into the editor:

```tsx
  const consumeTask = useCallback(async (taskId: string) => {
    const now = new Date().toISOString();
    await db.projectTasks.update(taskId, { deletedAt: now, updatedAt: now });
    const todayEntries = await db.todayTasks
      .where('projectTaskId')
      .equals(taskId)
      .filter((tt) => !tt.deletedAt)
      .toArray();
    for (const tt of todayEntries) {
      await db.todayTasks.update(tt.id, { deletedAt: now, updatedAt: now });
    }
  }, []);
```

Then pass the new props at **both** `ProjectDraftEditor` call sites (desktop at
line 578 and mobile at line 626) — add to each:

```tsx
                  onConsumeTask={consumeTask}
                  onRegisterCut={registerCut}
```

and at **both** `ProjectTaskList` call sites (line 611 and line 659) — change
each to:

```tsx
                <ProjectTaskList projectId={activeProject.id} onCutDescriptionRange={cutDescriptionRange} />
```

- [ ] **Step 7: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds. If `isCopyModifier` is flagged as
unused in `ProjectDraftEditor.tsx`, remove it from that file's import — it is
only used in `ProjectTaskList.tsx`.

- [ ] **Step 8: Manual check**

On `/projects` with a project open, desktop width:

1. Click into the description to enter edit mode. Type three lines. Select one
   line and drag it onto the task panel. **Expected:** the task panel highlights
   during the drag, a task appears with that text, and the line is gone from the
   description.
2. Repeat holding ⌘ (macOS) or Ctrl. **Expected:** the task is created and the
   description keeps the text.
3. Select a multi-line block and drag it over. **Expected:** one task per
   non-empty line.
4. Drag a task row from the panel into the description. **Expected:** the editor
   shows an accent ring during the drag, the title lands as its own line, and the
   task disappears from the list.
5. Drag a task row up and down *within* the panel. **Expected:** reordering still
   works exactly as before.
6. Fill the project to the task limit so the add row disappears, then drag text
   over the panel. **Expected:** no highlight, no task created, description
   unchanged.

- [ ] **Step 9: Commit**

```bash
git add client/src/utils/taskDnd.ts client/src/components/projects/ProjectDraftEditor.tsx client/src/components/projects/ProjectTaskList.tsx client/src/components/projects/ProjectsView.tsx
git commit -m "feat(projects): drag text into tasks and tasks back into text

Selected description text dropped on the task panel becomes one task per
line and is cut from the description; hold Cmd/Ctrl to copy instead. A task
row dropped into the description is inserted at the caret and soft-deleted.
Custom MIME types keep foreign drags out, and effectAllowed stays 'copy' so
no engine mutates the drag source behind our back."
```

---

## Task 7: Rename tasks on the task selection tab

`SelectableTaskRow` has no rename affordance. `TaskItem` already implements the
whole interaction inline. Extract it once and use it in both places.

**Files:**
- Create: `client/src/components/ui/InlineTextEdit.tsx`
- Modify: `client/src/components/projects/TaskItem.tsx:45-95`
- Modify: `client/src/components/taskSelection/SelectableTaskRow.tsx`
- Modify: `client/src/components/taskSelection/TaskGroupCard.tsx`
- Modify: `client/src/components/taskSelection/TaskSelectionView.tsx`
- Modify: `client/src/i18n/translations.ts`

- [ ] **Step 1: Create the shared control**

Create `client/src/components/ui/InlineTextEdit.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';

interface InlineTextEditProps {
  value: string;
  editing: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Single-line click-to-edit text.
 *
 * Commit rules, shared by every caller: Enter and blur commit, Escape reverts,
 * and an empty or unchanged value reverts rather than writing. The caller owns
 * the `editing` flag so it can decide what opens the editor (double-click, a
 * context-menu entry, a pencil button).
 */
export function InlineTextEdit({ value, editing, onCommit, onCancel, className = '' }: InlineTextEditProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      setDraft(value);
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      onCancel();
    }
  };

  if (!editing) return null;

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className={`w-full bg-transparent focus:outline-none ${className}`}
    />
  );
}
```

- [ ] **Step 2: Add rename to `SelectableTaskRow`**

In `client/src/components/taskSelection/SelectableTaskRow.tsx`, add the import:

```ts
import { InlineTextEdit } from '../ui/InlineTextEdit';
```

Add a prop to `SelectableTaskRowProps` (lines 9–21):

```ts
  onRename?: (title: string) => void;
```

and accept `onRename` in the destructured parameters.

Add state next to the existing `ctxMenu` state:

```tsx
  const [renaming, setRenaming] = useState(false);
```

Extend `contextMenuItems` (lines 85–87) to:

```tsx
  const contextMenuItems = useMemo(() => {
    const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
    if (onRename) {
      items.push({ label: t('common.rename'), onClick: () => setRenaming(true) });
    }
    items.push({ label: t('common.delete'), onClick: onDelete, danger: true });
    return items;
  }, [t, onDelete, onRename]);
```

Replace the task title `<span>` (lines 144–152) with:

```tsx
            {renaming && onRename ? (
              <InlineTextEdit
                value={task.title}
                editing={renaming}
                onCommit={(title) => { onRename(title); setRenaming(false); }}
                onCancel={() => setRenaming(false)}
                className="block text-[15px] leading-snug text-text-primary"
              />
            ) : (
              <span
                onDoubleClick={() => onRename && setRenaming(true)}
                className={`block text-[15px] leading-snug ${
                  isCompleted
                    ? 'line-through text-text-muted'
                    : isInToday
                      ? 'text-text-primary'
                      : 'text-text-secondary'
                }`}
              >
                {task.title}
              </span>
            )}
```

- [ ] **Step 3: Pass the rename handler through both parents**

In `client/src/components/taskSelection/TaskGroupCard.tsx`, pull `updateTask`
from the hook on line 48:

```tsx
  const { reorderTasks, toggleTask, deleteTask, updateTask } = useProjectTasks(project.id);
```

Add to **both** `SelectableTaskRow` usages in that file (the incomplete list at
line 164 and the completed list at line 207):

```tsx
                  onRename={(title) => updateTask(task.id, { title })}
```

In `client/src/components/taskSelection/TaskSelectionView.tsx`, the flat view has
no per-project hook. Add a direct rename next to the existing inline `onDelete`
handlers — add to **both** `SelectableTaskRow` usages (line 459 and line 523):

```tsx
                onRename={async (title) => {
                  await db.projectTasks.update(task.id, {
                    title,
                    updatedAt: new Date().toISOString(),
                  });
                }}
```

- [ ] **Step 4: Refactor `TaskItem` onto the shared control**

In `client/src/components/projects/TaskItem.tsx`, add the import:

```ts
import { InlineTextEdit } from '../ui/InlineTextEdit';
```

Delete the now-duplicated local state and handlers — remove `editValue`,
`inputRef`, the `useEffect` that syncs `editValue` from `task.title` (lines
61–63), the `useEffect` that focuses the input (lines 65–71), `handleSave`
(lines 73–81), and `handleKeyDown` (lines 83–90). Keep the `editing` state.

Then replace the editing branch in the render (lines 132–140):

```tsx
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent text-text-primary focus:outline-none border-none py-0"
          />
        ) : (
```

with:

```tsx
        {editing ? (
          <div className="flex-1">
            <InlineTextEdit
              value={task.title}
              editing={editing}
              onCommit={(title) => { onRename(title); setEditing(false); }}
              onCancel={() => setEditing(false)}
              className="text-sm text-text-primary py-0"
            />
          </div>
        ) : (
```

The `<span>` in the `else` branch (lines 141–151), the checkbox button above it,
and the recurrence controls below are all unchanged.

- [ ] **Step 5: Add the `common.rename` translation key**

In `client/src/i18n/translations.ts`, add to all five language blocks next to the
existing `'common.delete'` key:

```ts
  'common.rename': 'Rename',      // en
  'common.rename': '重命名',        // zh
  'common.rename': 'Renombrar',   // es
  'common.rename': 'Renomear',    // pt
  'common.rename': 'Переименовать', // ru
```

- [ ] **Step 6: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds. `tsc` will flag any language block
that is missing `common.rename`.

- [ ] **Step 7: Manual check**

On `/tasks`, grouped view: double-click a task title. **Expected:** it becomes an
input with the caret at the end. Type a new title and press Enter — the title
updates. Double-click another, type, and press Escape — it reverts. Right-click a
task and pick "Rename" — the same editor opens. Switch to flat view and confirm
rename works there too.

On `/projects`, confirm the task panel's existing rename still behaves the same
(Enter commits, Escape reverts, blur commits).

- [ ] **Step 8: Commit**

```bash
git add client/src/components/ui/InlineTextEdit.tsx client/src/components/projects/TaskItem.tsx client/src/components/taskSelection/SelectableTaskRow.tsx client/src/components/taskSelection/TaskGroupCard.tsx client/src/components/taskSelection/TaskSelectionView.tsx client/src/i18n/translations.ts
git commit -m "feat(tasks): rename tasks from the task selection tab

Extracts TaskItem's inline-edit interaction into ui/InlineTextEdit so the
commit rules live in one place, and wires it into SelectableTaskRow via
double-click and a Rename context-menu entry."
```

---

## Task 8: Vault picks up external changes quickly

On Android the native watcher is unavailable and `PollingWatcher` takes over. It
polls every 30 s and **cannot detect modifications at all** — `scanDir` stores a
constant `1` per path, so only create and delete are ever reported. A file edited
in place by an external sync tool never propagates.

**Files:**
- Modify: `client/src/vault/pollingWatcher.ts`
- Modify: `client/src/vault/vaultStore.ts`

- [ ] **Step 1: Record real mtimes and detect modifications**

Replace the whole body of `client/src/vault/pollingWatcher.ts` (keep the file's
existing import on line 1) with:

```ts
import type { WatchCallback, FileEvent } from './vaultBackend';

/** How often to re-scan the vault directory. */
export const POLL_INTERVAL_MS = 5000;

/**
 * Polling-based file watcher for Android.
 *
 * Native inotify watchers do not work reliably on external storage, so the
 * vault directory is re-scanned on a fixed interval and on app resume.
 *
 * The snapshot stores each file's mtime, which is what makes modification
 * detection possible — an earlier version stored a constant, so a file edited
 * in place by an external sync tool was never reported as changed.
 */
export class PollingWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private snapshot: Map<string, number> = new Map(); // path -> mtime (ms)
  private basePath: string;
  private callback: WatchCallback;
  private visibilityHandler: (() => void) | null = null;
  private polling = false;

  constructor(basePath: string, callback: WatchCallback) {
    this.basePath = basePath;
    this.callback = callback;
  }

  async start(intervalMs = POLL_INTERVAL_MS): Promise<void> {
    await this.buildSnapshot();

    this.intervalId = setInterval(() => this.poll(), intervalMs);

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.poll();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private async poll(): Promise<void> {
    // A slow scan must not overlap itself now that the interval is short.
    if (this.polling) return;
    this.polling = true;
    try {
      const currentFiles = new Map<string, number>();
      await this.scanDir('', currentFiles);

      const events: FileEvent[] = [];

      for (const [path, mtime] of currentFiles) {
        const previous = this.snapshot.get(path);
        if (previous === undefined) {
          events.push({ type: 'create', path });
        } else if (previous !== mtime) {
          events.push({ type: 'modify', path });
        }
      }

      for (const [path] of this.snapshot) {
        if (!currentFiles.has(path)) {
          events.push({ type: 'delete', path });
        }
      }

      this.snapshot = currentFiles;

      if (events.length > 0) {
        this.callback(events);
      }
    } catch (err) {
      console.error('[vault] Polling watcher error:', err);
    } finally {
      this.polling = false;
    }
  }

  private async buildSnapshot(): Promise<void> {
    try {
      this.snapshot = new Map();
      await this.scanDir('', this.snapshot);
    } catch {
      // Directory may not exist yet
    }
  }

  private async scanDir(dir: string, files: Map<string, number>): Promise<void> {
    const { readDir, stat } = await import('@tauri-apps/plugin-fs');
    const fullPath = dir ? `${this.basePath}/${dir}` : this.basePath;
    try {
      const entries = await readDir(fullPath);
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const relativePath = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory) {
          await this.scanDir(relativePath, files);
        } else {
          let mtime = 0;
          try {
            const info = await stat(`${this.basePath}/${relativePath}`);
            mtime = info.mtime ? new Date(info.mtime).getTime() : 0;
          } catch {
            // Unreadable file — treat as unchanged rather than churning events.
            mtime = this.snapshot.get(relativePath) ?? 0;
          }
          files.set(relativePath, mtime);
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }
}
```

Note `scanDir` no longer takes a `readDir` parameter — it imports both `readDir`
and `stat` itself. Both `poll()` and `buildSnapshot()` above already call it with
the new two-argument signature.

- [ ] **Step 2: Add a reconcile heartbeat to the vault store**

In `client/src/vault/vaultStore.ts`, add near the top of the file, after the
imports:

```ts
/** Full reconcile interval — a safety net for anything the watcher misses. */
const RECONCILE_INTERVAL_MS = 60000;
```

Add a field to the `VaultState` interface (declared at line 69), immediately
after `_visibilityHandler: (() => void) | null;` on line 78:

```ts
  _reconcileTimer: ReturnType<typeof setInterval> | null;
```

and its initial value in the store body, immediately after
`_visibilityHandler: null,` on line 95:

```ts
  _reconcileTimer: null,
```

In `enable()`, immediately after the existing `set({ _visibilityHandler: handler });`
(line 166), add:

```ts
    // Periodic full reconcile. The watcher is the fast path; this catches
    // anything it misses — a dropped event, a platform where watching silently
    // does nothing, or a file written while the app was suspended.
    const reconcileTimer = setInterval(() => {
      const { isSyncing } = get();
      if (isSyncing) return;
      get().syncNow();
    }, RECONCILE_INTERVAL_MS);
    set({ _reconcileTimer: reconcileTimer });
```

In `disable()`, add the teardown after the `_visibilityHandler` cleanup (lines
175–177) and before `await writeQueue.flush();` (line 179):

```ts
    if (state._reconcileTimer) {
      clearInterval(state._reconcileTimer);
    }
```

and add `_reconcileTimer: null,` to the `set({ ... })` call at the end of
`disable()`, next to the existing `_unwatchFs: null,` on line 187.

- [ ] **Step 3: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds. If `tsc` complains that `FileInfo.mtime`
may be `null`, the `info.mtime ? ... : 0` guard above already handles it — check
you copied that line exactly.

- [ ] **Step 4: Manual check (desktop Tauri)**

This path only runs under Tauri, not `npm run dev` in a browser. Build and run
the desktop app with a vault configured, then from a terminal edit a file in the
vault directory in place:

```bash
echo "" >> <vault-path>/activities/<some-activity>.md
```

Expected: the change is reflected in the app within about a minute (reconcile
heartbeat) and near-instantly on desktop via the native watcher.

- [ ] **Step 5: Manual check (Android)**

Per the project's recorded workflow:

```bash
cd client && npx tauri android build --apk --debug
adb install -r client/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

With the vault on shared storage, modify a vault file from the desktop (or via
`adb shell`) and confirm the change appears in the app within roughly 5 seconds
rather than not at all.

If a two-device setup is not available at implementation time, say so plainly in
the commit and hand the verification back to the user — do not claim it passed.

- [ ] **Step 6: Commit**

```bash
git add client/src/vault/pollingWatcher.ts client/src/vault/vaultStore.ts
git commit -m "fix(vault): detect file modifications and poll more often

The Android polling watcher stored a constant instead of an mtime, so files
edited in place were never reported — only creates and deletes. Snapshot
real mtimes, drop the interval from 30s to 5s with overlap protection, and
add a 60s full reconcile as a safety net for missed events."
```

---

## Task 9: Freeze the Ideas section

The reported title loss has a concrete cause: `serializeNote` writes to
`notes/${entityFilename(n.title || 'Untitled', n.id)}.md` — the title is part of
the *filename*. Renaming a note writes a new file and can leave a stale one
behind, which later re-imports over the current row.

Freezing makes Ideas read-only and stops the vault writing notes in either
direction, without deleting any data. Fixing the filename design is deliberately
**out of scope** — that is its own change.

**Files:**
- Modify: `shared/constants.ts`
- Modify: `client/src/components/notes/NoteList.tsx`
- Modify: `client/src/components/notes/NoteEditor.tsx`
- Modify: `client/src/vault/vaultSync.ts`
- Modify: `client/src/i18n/translations.ts`

- [ ] **Step 1: Add the flag**

Append to `shared/constants.ts`:

```ts
/**
 * Ideas (notes) is frozen: read-only in the UI and excluded from vault sync in
 * both directions.
 *
 * Reason: serializeNote() encodes the note title into the filename, so renaming
 * a note orphans its previous file, and the stale copy can later re-import over
 * the live row — notes were losing their titles and then disappearing. Freezing
 * stops the damage without deleting anything. Set to false to restore the
 * section once the filename scheme is fixed.
 */
export const IDEAS_FROZEN = true;
```

- [ ] **Step 2: Make the note list read-only**

In `client/src/components/notes/NoteList.tsx`, add the import:

```ts
import { IDEAS_FROZEN } from '@shared/constants';
```

Replace the header block (lines 78–82) with:

```tsx
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('ideas.title')}
        </h1>
      </div>

      {IDEAS_FROZEN && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 text-xs">
          {t('ideas.frozen')}
        </div>
      )}
```

Replace the "new note" button (lines 103–109) with a conditional so it disappears
when frozen:

```tsx
        {!IDEAS_FROZEN && (
          <button
            onClick={handleNewNote}
            className="rounded-2xl p-3 w-full flex items-center justify-center text-sm font-medium text-text-muted hover:text-text-secondary transition-colors mb-3"
            style={{ boxShadow: NEU.pressed, minHeight: '80px' }}
          >
            {t('ideas.new')}
          </button>
        )}
```

Stop offering pin and delete on notes while frozen. Change the `NoteCard` usage
(lines 87–92) to:

```tsx
            <NoteCard
              key={item.data.id}
              note={item.data}
              onClick={() => handleOpenNote(item.data)}
              onTogglePin={IDEAS_FROZEN ? undefined : () => toggleNotePin(item.data.id)}
            />
```

and the `NoteEditor` usage (lines 114–121) to:

```tsx
      <NoteEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingNote(null); }}
        createNote={createNote}
        updateNote={updateNote}
        onDelete={IDEAS_FROZEN || !editingNote ? undefined : handleDeleteNote}
        note={editingNote}
      />
```

Read `NoteCard.tsx` first to confirm `onTogglePin` is optional; if its prop type
requires the handler, widen it to `onTogglePin?: () => void` and guard the call
site inside that component.

PDF uploads are a separate feature and stay enabled — leave `PdfUploadButton`,
`PdfCard`, and `PdfViewer` untouched.

- [ ] **Step 3: Disable the note editor's inputs**

`NoteEditor` is a per-line click-to-edit markdown editor: clicking a rendered
line swaps it for a `<textarea>`. The complete freeze is therefore three edits —
stop lines from entering edit mode, make the title read-only, and disable the
colour swatches. The delete button is already gated on the `onDelete` prop, which
Step 2 now passes as `undefined`, so it needs no change here.

Add the import:

```ts
import { IDEAS_FROZEN } from '@shared/constants';
```

**(a) Block line editing.** Find `handleLineClick` and `handleContainerClick` in
the component and make each return early. Add as the first statement of both
function bodies:

```ts
    if (IDEAS_FROZEN) return;
```

This is what actually makes the content read-only: with no line able to enter
edit mode, `editingLine` stays `null` and only rendered lines are shown.

**(b) Make the title read-only.** Replace the title input (lines 259–265):

```tsx
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); latestRef.current.title = e.target.value; scheduleSave(); }}
              placeholder={t('ideas.titlePlaceholder')}
              autoFocus
              className="w-full bg-transparent text-2xl font-bold text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-4 border-none"
            />
```

with:

```tsx
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); latestRef.current.title = e.target.value; scheduleSave(); }}
              placeholder={t('ideas.titlePlaceholder')}
              autoFocus={!IDEAS_FROZEN}
              readOnly={IDEAS_FROZEN}
              className="w-full bg-transparent text-2xl font-bold text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-4 border-none"
            />
```

`readOnly` rather than `disabled` so the title stays selectable and copyable.

**(c) Disable the colour swatches.** Replace the swatch button (lines 223–233):

```tsx
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(c); latestRef.current.color = c; scheduleSave(); }}
                  className="w-5 h-5 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? NEU.pressedSm : NEU.raisedSm,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
```

with:

```tsx
                <button
                  key={c}
                  type="button"
                  disabled={IDEAS_FROZEN}
                  onClick={() => { setColor(c); latestRef.current.color = c; scheduleSave(); }}
                  className="w-5 h-5 rounded-full transition-transform disabled:cursor-default"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? NEU.pressedSm : NEU.raisedSm,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
```

The close button (lines 212–218) is deliberately left working so the editor can
still be dismissed.

- [ ] **Step 4: Exclude notes from vault sync in both directions**

In `client/src/vault/vaultSync.ts`, add the import:

```ts
import { IDEAS_FROZEN } from '@shared/constants';
```

There are **four** call sites. Guard each one.

Export (around line 67), change:

```ts
  // Notes
  const notes = await db.notes.filter(n => !n.deletedAt).toArray();
```

to:

```ts
  // Notes — skipped while Ideas is frozen (see IDEAS_FROZEN).
  const notes = IDEAS_FROZEN ? [] : await db.notes.filter(n => !n.deletedAt).toArray();
```

Import (around line 228), change:

```ts
  try {
    const noteFiles = await backend.listFiles('notes', '.md');
```

to:

```ts
  try {
    const noteFiles = IDEAS_FROZEN ? [] : await backend.listFiles('notes', '.md');
```

Per-entity write path (around line 439), change the `case 'notes':` body to
return immediately:

```ts
    case 'notes': {
      if (IDEAS_FROZEN) return;
      const n = await db.notes.get(entityId);
```

External change handling (around line 670), change:

```ts
  } else if (filePath.startsWith('notes/')) {
    const note = deserializeNote(content);
    await mergeEntity(db.notes, note);
    fileIndex.set(note.id, filePath);
```

to:

```ts
  } else if (filePath.startsWith('notes/')) {
    if (IDEAS_FROZEN) return;
    const note = deserializeNote(content);
    await mergeEntity(db.notes, note);
    fileIndex.set(note.id, filePath);
```

Leave `tableFromPath` (around line 771) alone — it is a pure path classifier and
the guards above already stop the work.

- [ ] **Step 5: Add the banner translation key**

In `client/src/i18n/translations.ts`, add `'ideas.frozen'` to all five blocks
next to the existing `'ideas.title'` key:

```ts
  'ideas.frozen': 'Ideas is paused — existing notes are read-only while a sync issue is fixed.',        // en
  'ideas.frozen': '灵感已暂停 — 修复同步问题期间，现有笔记为只读。',                                          // zh
  'ideas.frozen': 'Ideas está en pausa — las notas existentes son de solo lectura mientras se corrige un problema de sincronización.', // es
  'ideas.frozen': 'Ideias está pausado — as notas existentes são somente leitura enquanto um problema de sincronização é corrigido.',  // pt
  'ideas.frozen': 'Идеи на паузе — существующие заметки доступны только для чтения, пока чинится синхронизация.', // ru
```

- [ ] **Step 6: Typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

Expected: no `tsc` output; build succeeds. `tsc` will flag any language block
missing `ideas.frozen`, and any `NoteEditor` prop type that rejects `undefined`
for `onDelete`.

- [ ] **Step 7: Manual check**

On `/notes`: the banner is visible, there is no "new note" button, and the PDF
upload button still works. Open an existing note — the title and content are
visible but not editable, and there is no delete or save button. Close it. Confirm
no note content was altered.

- [ ] **Step 8: Commit**

```bash
git add shared/constants.ts client/src/components/notes/NoteList.tsx client/src/components/notes/NoteEditor.tsx client/src/vault/vaultSync.ts client/src/i18n/translations.ts
git commit -m "fix(ideas): freeze the Ideas section read-only

serializeNote encodes the note title into the filename, so renaming a note
orphans its old file and the stale copy can re-import over the live row —
titles reverted to Untitled and notes eventually vanished. Gate the UI and
both directions of vault sync on IDEAS_FROZEN. No note rows or vault files
are deleted; flipping the flag restores the section."
```

---

## Final verification

- [ ] **Step 1: Clean typecheck and build**

```bash
cd client && npx tsc --noEmit && npm run build
```

- [ ] **Step 2: Walk all nine behaviors once, in one session**

1. Type a task title on `/projects`, switch project tab and route, return — text preserved.
2. Drag selected description text onto the task panel — task created, text cut. Drag a task into the description — line inserted, task gone.
3. Drag-select text in the rendered description — selection holds. Press Backspace outside a field — no navigation.
4. Toggle the description between rendered and editing — no vertical jump.
5. Start, reload, and stop a timer — always non-negative; a timer from another device is not adopted.
6. Rename a task on `/tasks` by double-click and by context menu.
7. Project cards and the task panel header show a bare count.
8. Edit a vault file externally — the change lands promptly (Tauri only).
9. `/notes` is read-only with a banner, and no note files are written to the vault.

- [ ] **Step 3: Report honestly**

Anything not verified — most likely the two-device timer check and the Android
vault check — must be reported as unverified, with the reason. Do not describe
those as passing.

---

## Deviations from the spec

- **Spec §4** described one shared typography box. The plan additionally stacks
  the preview and the textarea in a single CSS grid cell (Task 5). Typography
  parity alone fixes ordinary lines but not headings; the grid stack makes
  container jump impossible regardless of content, which is what the user
  actually sees. Heading lines remain taller when rendered — called out in Task 5
  Step 5 as a known, intentional limit with a documented follow-up.
- **Spec §2** said a dropped selection becomes "a task". The plan creates **one
  task per non-empty line** (Task 6 Step 4), since dragging a multi-line block is
  the natural way to unload a draft and a single task containing newlines would
  render badly.
