# Data Flow Reference

**Project:** JediNotebook (productivity app)
**Documented:** 2026-03-03
**Source of truth:** Every hook, store, worker, and sync file was read in full.

---

## Table of Contents

1. [Core Architecture Diagram](#core-architecture-diagram)
2. [Dexie Database Schema](#dexie-database-schema)
3. [Hook Reference (21 hooks)](#hook-reference)
4. [Store Reference (6 stores)](#store-reference)
5. [Worker Reference (2 workers)](#worker-reference)
6. [Feature Data Flows](#feature-data-flows)
7. [Sync Data Flow](#sync-data-flow)
8. [Gamification / XP System](#gamification--xp-system)
9. [Cross-Cutting Patterns](#cross-cutting-patterns)

---

## Core Architecture Diagram

```
User Action
    |
    v
React Component
    |
    +---> Hook (useXxx)  ---> Dexie (IndexedDB)
    |         |                    |
    |         |  useLiveQuery()    | onChange
    |         |<-------------------+
    |         |
    |         +---> awardXP() ---> settingsStore ---> Dexie settings table
    |
    +---> Zustand Store (timerStore, pomodoroStore, etc.)
    |         |
    |         +---> Web Worker (tick every 1s)
    |         |         |
    |         |         +---> postMessage('tick')
    |         |                    |
    |         |<-------------------+
    |         |    store.tick()
    |         |
    |         +---> Dexie (on start/stop only)
    |
    +---> settingsStore
              |
              +---> Dexie settings table (on every update)
              +---> DOM manipulation (theme class, CSS vars, zoom)
```

**Two data persistence paths exist:**

1. **Hook path (most features):** Component calls hook method --> hook writes to Dexie --> `useLiveQuery()` detects change --> component re-renders.
2. **Store path (timer, pomodoro, settings, task timer):** Component calls store action --> Zustand state updates --> component re-renders via selector. Store action may also write to Dexie (timerStore on start/stop, settingsStore on every update).

---

## Dexie Database Schema

**Database name:** `TimeTrackerDB`
**Current schema version:** 9 (added `pdfDocuments` table)

### Tables and Indexes

| Table | Indexes | Entity Type |
|-------|---------|-------------|
| `activities` | `id, name, sortOrder, deletedAt, updatedAt` | `Activity` |
| `timeEntries` | `id, activityId, date, startedAt, endedAt, deletedAt, updatedAt` | `TimeEntry` |
| `settings` | `id` | `UserSettings` |
| `habits` | `id, name, sortOrder, deletedAt, updatedAt` | `Habit` |
| `habitEntries` | `id, habitId, date, deletedAt, updatedAt, [habitId+date]` | `HabitEntry` |
| `notes` | `id, isPinned, deletedAt, updatedAt` | `Note` |
| `pomodoroPresets` | `id, name, sortOrder, deletedAt, updatedAt` | `PomodoroPreset` |
| `projects` | `id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt` | `Project` |
| `projectTasks` | `id, projectId, sortOrder, isCompleted, deletedAt, updatedAt` | `ProjectTask` |
| `todayTasks` | `id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt` | `TodayTask` |
| `projectFolders` | `id, name, parentFolderId, sortOrder, deletedAt, updatedAt` | `ProjectFolder` |
| `inboxItems` | `id, deletedAt, updatedAt` | `InboxItem` |
| `mindMaps` | `id, deletedAt, updatedAt` | `MindMap` |
| `pdfDocuments` | `id, isPinned, deletedAt, updatedAt` | `PdfDocument` |

### Compound Index

- `habitEntries.[habitId+date]` -- enables efficient lookup of a specific habit's entry on a specific date.

### Schema Version History

| Version | Changes | Upgrade Function |
|---------|---------|------------------|
| 1 | `activities`, `timeEntries`, `settings` | None |
| 2 | +`habits`, `habitEntries` | None |
| 3 | +`notes` | None |
| 4 | +`pomodoroPresets` | None |
| 5 | +`projects`, `projectTasks`, `todayTasks` | None |
| 6 | +`projectFolders`, `folderId` index on projects | Yes: sets `folderId=null` on existing projects, adds `recurrenceRule=null` and `lastRecurredDate=null` on existing tasks |
| 7 | +`inboxItems` | None |
| 8 | +`mindMaps` | None |
| 9 | +`pdfDocuments` | None |

### Synced vs Local-Only Tables

| Synced (server has copy) | Local-only |
|--------------------------|------------|
| `activities` | `habits`, `habitEntries` |
| `timeEntries` | `notes` |
| `settings` | `pomodoroPresets` |
| | `projects`, `projectTasks`, `todayTasks` |
| | `projectFolders` |
| | `inboxItems` |
| | `mindMaps` |
| | `pdfDocuments` |

---

## Hook Reference

### useActivities()

- **File:** `client/src/hooks/useActivities.ts`
- **Tables:** `activities`
- **Reactive query:** `db.activities.filter(a => !a.deletedAt).sortBy('sortOrder')` -- re-renders on any change to activities table
- **Dependencies:** `[]` (runs once, auto-reactive via Dexie)
- **Returns:**
  - `activities: Activity[]` -- all non-deleted activities sorted by sortOrder
  - `createActivity(name, dailyBudgetMinutes, color?)` -- generates UUID v7, auto-assigns color from unused pool via `getNextColor()`, sets `sortOrder` to current count
  - `updateActivity(id, patch)` -- partial update of `name | dailyBudgetMinutes | sortOrder | color`
  - `deleteActivity(id)` -- soft delete (sets `deletedAt`)
- **Side effects:** None. No cascade deletes, no store interactions.

---

### useAllProjectTasks()

- **File:** `client/src/hooks/useAllProjectTasks.ts`
- **Tables:** `projects`, `projectTasks`, `projectFolders`
- **Reactive queries (two):**
  1. Flat groups: all non-deleted, non-archived projects with their tasks (split into incomplete sorted by `sortOrder` and completed sorted by `completedAt` desc)
  2. Folder groups: same data grouped by `folderId`, with `projectFolders` providing folder metadata. Unfiled projects (folderId=null) go into a `{ folder: null }` group at the end.
- **Dependencies:** `[]` for both queries
- **Returns:**
  - `groups: TaskGroup[]` -- `{ project, tasks (incomplete), completedTasks }`
  - `folderGroups: FolderGroup[]` -- `{ folder: ProjectFolder | null, projects: TaskGroup[] }`
- **Side effects:** None. Read-only aggregation hook.

---

### useAnalytics()

- **File:** `client/src/hooks/useAnalytics.ts`
- **Tables:** `activities`, `timeEntries`
- **Reactive query:** `db.activities.filter(a => !a.deletedAt).toArray()` -- provides activity list reactively
- **Dependencies:** `[]`
- **Returns:**
  - `activities: Activity[]`
  - `getDailySummary(date: string): Promise<DailySummary[]>` -- queries `timeEntries` by `date` index, joins with activities, aggregates `durationSeconds` per activity
  - `getWeeklySummary(endDate): Promise<WeekDay[]>` -- calls `getDailySummary` for each of 7 days
  - `getMonthlySummary(endDate): Promise<WeekDay[]>` -- calls `getDailySummary` for each of 30 days
  - `getStreaks(): Promise<StreakInfo[]>` -- loads ALL non-deleted time entries, groups by date, walks backwards from today up to 365 days per activity
  - `getAverages(days=7): Promise<{activityId, activityName, avgSeconds}[]>` -- averages durations over N days
- **Side effects:** None. The summary/streak/average functions are imperative (not reactive) -- they must be called explicitly and return Promises.

---

### useDayBoundary(onDayChange)

- **File:** `client/src/hooks/useDayBoundary.ts`
- **Tables:** None
- **Reactive query:** None (not a Dexie hook)
- **Store dependency:** Reads `settingsStore.dayStartHour`
- **Behavior:** Sets a 60-second interval that checks `new Date().getHours() === dayStartHour && minutes === 0`. If true, calls the provided `onDayChange` callback.
- **Returns:** Nothing (void). Side-effect-only hook.

---

### useFolders()

- **File:** `client/src/hooks/useFolders.ts`
- **Tables:** `projectFolders`, `projects` (on delete)
- **Reactive query:** `db.projectFolders.filter(f => !f.deletedAt).toArray()` then sorted by `sortOrder`
- **Dependencies:** `[]`
- **Returns:**
  - `folders: ProjectFolder[]`
  - `createFolder(name, color?, parentFolderId?)` -- random color from `ACTIVITY_COLORS` if not provided
  - `updateFolder(id, patch)` -- partial update of `name | color | isExpanded`
  - `toggleExpanded(id)` -- reads current folder, flips `isExpanded` boolean
  - `deleteFolder(id)` -- soft-deletes folder, then **moves child projects to root** (`folderId=null`) rather than deleting them
- **Side effects on delete:** Queries `projects.where('folderId').equals(id)` and sets each project's `folderId` to `null`. This is a reparenting operation, not a cascade delete.

---

### useHabits()

- **File:** `client/src/hooks/useHabits.ts`
- **Tables:** `habits`, `habitEntries`
- **Reactive queries (two):**
  1. `db.habits.filter(h => !h.deletedAt).sortBy('sortOrder')`
  2. `db.habitEntries.filter(e => !e.deletedAt && weekDates.includes(e.date))` -- filtered to current Monday-Sunday week
- **Dependencies:** `[]` for habits, `[weekDates[0]]` for entries (re-runs when week changes)
- **Computed state:** `streaks: Record<habitId, number>` -- computed via `useEffect` that calls `computeStreak()` for each habit. Walks backwards from today using compound index `[habitId+date]`.
- **Returns:**
  - `habits: Habit[]`
  - `weekEntries: HabitEntry[]`
  - `weekDates: string[]` -- 7 YYYY-MM-DD strings for current week
  - `today: string` -- today's YYYY-MM-DD
  - `streaks: Record<string, number>`
  - `createHabit(data)` -- creates with `type`, `targetValue`, `unit`, `color`, `icon`
  - `toggleBooleanHabit(habitId, date)` -- upserts entry: if exists, toggles `value` 0/1; if new, creates with `value=1, completed=true`. Awards XP on completion.
  - `logNumericHabit(habitId, date, value)` -- upserts entry: adds `value` to existing (clamped to 0 minimum). Marks `completed` when `value >= targetValue`. Awards XP on first completion.
  - `deleteHabit(id)` -- soft delete (does NOT cascade-delete entries)
- **Side effects:** Calls `awardXP(XP_VALUES.checkHabit)` when a boolean habit is checked or numeric habit reaches target.

---

### useInbox()

- **File:** `client/src/hooks/useInbox.ts`
- **Tables:** `inboxItems`
- **Reactive query:** `db.inboxItems.filter(item => !item.deletedAt).toArray()` sorted by `createdAt` descending (newest first)
- **Dependencies:** `[]`
- **Returns:**
  - `items: InboxItem[]`
  - `addItem(text)` -- creates item. Awards XP. Returns created item.
  - `updateItem(id, text)` -- updates text only
  - `deleteItem(id)` -- soft delete
- **Side effects:** `awardXP(XP_VALUES.addInboxItem)` on add.

---

### useMindMaps()

- **File:** `client/src/hooks/useMindMaps.ts`
- **Tables:** `mindMaps`
- **Reactive query:** `db.mindMaps.filter(m => !m.deletedAt).toArray()` sorted by `updatedAt` descending (most recently edited first)
- **Dependencies:** `[]`
- **Returns:**
  - `mindMaps: MindMap[]`
  - `createMindMap(title)` -- creates with a single root node. Random color. Awards XP. Returns created map.
  - `updateMindMap(id, patch)` -- partial update of `title | nodes | color`
  - `deleteMindMap(id)` -- soft delete
  - `addNode(mindMapId, parentNodeId, text, direction?)` -- reads entire mind map, appends new node to `nodes[]` array, adds its ID to parent's `children[]`. Returns new node.
  - `addNodeAtIndex(mindMapId, parentNodeId, text, index, direction?)` -- same as addNode but splices into parent's children at specific index
  - `updateNode(mindMapId, nodeId, patch)` -- updates `text | color | collapsed` on a specific node within the `nodes[]` array
  - `deleteNode(mindMapId, nodeId)` -- recursively collects all descendant IDs, filters them out of `nodes[]`, removes their IDs from all `children[]` arrays. Refuses to delete root node.
- **Data model note:** Mind map nodes are stored as a **flat array** within the `MindMap.nodes` field (not a nested tree). Parent-child relationships use ID references in `children: string[]`. This means every node operation requires reading the full mind map record and writing back the entire `nodes[]` array.
- **Side effects:** `awardXP(XP_VALUES.createMindMap)` on create.

---

### useNotes()

- **File:** `client/src/hooks/useNotes.ts`
- **Tables:** `notes`
- **Reactive query:** `db.notes.filter(n => !n.deletedAt).toArray()` sorted by `isPinned` descending then `updatedAt` descending
- **Dependencies:** `[]`
- **Returns:**
  - `notes: Note[]`
  - `createNote(data)` -- creates with `title`, `content`, `color`. Awards XP. Returns created note.
  - `updateNote(id, patch)` -- partial update of `title | content | color`
  - `deleteNote(id)` -- soft delete
  - `togglePin(id)` -- reads current note, flips `isPinned` boolean
- **Side effects:** `awardXP(XP_VALUES.createNote)` on create.

---

### usePdfDocuments()

- **File:** `client/src/hooks/usePdfDocuments.ts`
- **Tables:** `pdfDocuments`
- **Reactive query:** `db.pdfDocuments.filter(p => !p.deletedAt).toArray()` sorted by `isPinned` descending then `updatedAt` descending
- **Dependencies:** `[]`
- **Returns:**
  - `pdfs: PdfDocument[]`
  - `createPdf(data)` -- creates with `title`, `fileName`, `fileSize`, `pageCount`, `pdfData` (Blob), `thumbnail` (Blob|null). Auto-assigns color. Returns created doc.
  - `updatePdf(id, patch)` -- partial update of `title | color`
  - `deletePdf(id)` -- soft delete
  - `togglePin(id)` -- reads current doc, flips `isPinned` boolean
- **Side effects:** None (no XP awarded).
- **Note:** Stores actual PDF binary data as Blobs directly in IndexedDB. This is the only entity with Blob fields.

---

### usePointsCounter()

- **File:** `client/src/hooks/usePointsCounter.ts`
- **Tables:** `projectTasks`
- **Store dependency:** Reads `settingsStore.pointsCounterVisible` and `settingsStore.update`
- **Reactive query:** `db.projectTasks.filter(t => !t.deletedAt && !t.isCompleted).toArray()`
- **Dependencies:** `[]`
- **Computed state:** `totalScore: number` -- computed via `useEffect` with 60-second interval. Formula: `sum(ageDays^2)` for each incomplete task, where `ageDays = (Date.now() - createdAt) / 86400000`. This is a staleness/urgency score -- older tasks contribute quadratically more.
- **Returns:**
  - `totalScore: number`
  - `isVisible: boolean` (from settings)
  - `toggleVisibility()` -- updates `pointsCounterVisible` in settingsStore
- **Side effects:** Writes to settingsStore on toggle.

---

### usePomodoro()

- **File:** `client/src/hooks/usePomodoro.ts`
- **Tables:** None directly (delegates to stores)
- **Store dependencies:** `pomodoroStore`, `timerStore`, `settingsStore`
- **Worker:** Creates a `pomodoro.worker.ts` Web Worker. Worker `onmessage` calls `pomodoroStore.tick()`.
- **Returns:** All pomodoroStore state fields plus:
  - `startPomodoro(preset: PomodoroPreset)` -- calls `pomodoroStore.startSession()` with preset config, requests notification permission
  - `pause()`, `resume()`, `skip()` -- direct delegates to pomodoroStore
  - `stop()` -- stops linked activity timer via `timerStore.stop()` if the linked activity is currently running, then calls `pomodoroStore.stop()`
- **Phase transition side effects (via useEffect):**
  - When `phase` changes to `'work'` and `linkedActivityId` is set: starts `timerStore` for that activity
  - When `phase` leaves `'work'`: stops `timerStore` for that activity
  - Sends browser `Notification` on every phase transition
- **Worker lifecycle (via useEffect):** Posts `'start'` to worker when `isActive && !isPaused`, posts `'stop'` otherwise.

---

### usePomodoroPresets()

- **File:** `client/src/hooks/usePomodoroPresets.ts`
- **Tables:** `pomodoroPresets`
- **Reactive query:** `db.pomodoroPresets.filter(p => !p.deletedAt).sortBy('sortOrder')`
- **Dependencies:** `[]`
- **Returns:**
  - `presets: PomodoroPreset[]`
  - `createPreset(data)` -- creates with all timing fields
  - `updatePreset(id, patch)` -- partial update of timing fields
  - `deletePreset(id)` -- soft delete. **Refuses to delete default presets** (checks `preset.isDefault`).
- **Side effects:** None.

---

### useProjects()

- **File:** `client/src/hooks/useProjects.ts`
- **Tables:** `projects`, `projectTasks` (on delete), `todayTasks` (on delete)
- **Reactive query:** `db.projects.filter(p => !p.deletedAt).toArray()` sorted by `sortOrder`
- **Dependencies:** `[]`
- **Returns:**
  - `projects: Project[]`
  - `createProject(data)` -- creates with `name`, `color`, `description?`, `folderId?`, `linkedActivityId?`. Awards XP. Returns created project.
  - `updateProject(id, patch)` -- partial update of `name | description | color | isArchived | folderId | linkedActivityId`
  - `moveProject(id, folderId)` -- convenience for updating just `folderId`
  - `deleteProject(id)` -- soft delete with **cascade**: soft-deletes all `projectTasks` where `projectId=id`, then soft-deletes all `todayTasks` where `projectId=id`
  - `reorderProjects(orderedIds)` -- sets `sortOrder=index` for each ID in array
- **Side effects on delete:** Two cascade soft-deletes across tables.
- **XP:** `awardXP(XP_VALUES.createProject)` on create.

---

### useProjectTasks(projectId)

- **File:** `client/src/hooks/useProjectTasks.ts`
- **Tables:** `projectTasks`, `todayTasks` (on delete and toggle)
- **Reactive query:** `db.projectTasks.where('projectId').equals(projectId).filter(t => !t.deletedAt).toArray()` sorted by `sortOrder`. Returns empty array if `projectId` is null.
- **Dependencies:** `[projectId]`
- **Returns:**
  - `tasks: ProjectTask[]`
  - `createTask(title, recurrenceRule?)` -- creates task under the given `projectId`. Awards XP. Returns created task.
  - `updateTask(id, patch)` -- partial update of `title`
  - `toggleTask(id)` -- flips `isCompleted` and sets/clears `completedAt`. Awards XP on completion. **Recurring task auto-creation:** If completing a task that has a `recurrenceRule`, immediately creates a new incomplete copy of the task with the same title and recurrence rule.
  - `updateRecurrence(id, recurrenceRule)` -- updates recurrence rule
  - `deleteTask(id)` -- soft delete with **cascade**: soft-deletes all `todayTasks` referencing this `projectTaskId`
  - `reorderTasks(orderedIds)` -- sets `sortOrder=index` for each ID
- **Side effects:** Cascade delete to todayTasks. Recurring task cloning. XP on create and complete.

---

### useRecurringTaskCheck()

- **File:** `client/src/hooks/useRecurringTaskCheck.ts`
- **Tables:** `projectTasks`
- **Reactive query:** None (imperative, runs once on mount)
- **Dependencies:** `[]`
- **Behavior:** On mount, scans all completed tasks with a non-null `recurrenceRule`. For each:
  1. Calls `shouldCreateRecurrence(lastRecurredDate, rule, today)` to check if a new instance is due
  2. Checks if an incomplete task with the same title already exists in the same project (deduplication)
  3. If due and no duplicate exists: creates a new incomplete task with the same title and recurrence rule, updates the original's `lastRecurredDate`
- **Returns:** Nothing (side-effect-only hook, runs on app mount).

---

### useTaskTimer()

- **File:** `client/src/hooks/useTaskTimer.ts`
- **Tables:** None directly (delegates to stores)
- **Store dependencies:** `taskTimerStore`, `timerStore`, `settingsStore`
- **Worker:** Uses a **module-level singleton** `pomodoro.worker.ts` instance (shared worker type, separate instance from pomodoro's). Worker `onmessage` calls `taskTimerStore.tick()`.
- **Returns:** All taskTimerStore state fields plus:
  - `startTask(todayTaskId, projectId, taskLinkedActivityId)` -- stops any current task timer, starts countdown from `settingsStore.taskTimerMinutes * 60` seconds, starts linked activity timer via `timerStore.start()` if `taskLinkedActivityId` is provided
  - `pauseTask()`, `resumeTask()` -- delegates to taskTimerStore
  - `stopTask()` -- stops linked activity timer if running, then stops task timer
  - `formatCountdown(): string` -- formats as `M:SS` or `+M:SS` (overtime)
- **Notification side effect:** Fires browser `Notification` when `countdownComplete` becomes true (once per countdown).
- **Worker lifecycle:** Posts `'start'`/`'stop'` to worker based on `isActive && !isPaused`.

---

### useThemeColors()

- **File:** `client/src/hooks/useThemeColors.ts`
- **Tables:** None
- **Store dependency:** Reads `settingsStore.customThemeColors`
- **DOM dependency:** Uses `useSyncExternalStore` to watch `<html>` `classList` changes via `MutationObserver`
- **Returns:** `{ textPrimary, textSecondary, accent, bgPrimary, border, barTrack }` -- hardcoded hex values per built-in theme, or dynamic values from `customThemeColors` for the `custom` theme. Used by Recharts for chart styling.
- **Also exports:**
  - `useIsDark(): boolean` -- true for all themes except `light` and `neu-light`
  - `useThemeMode(): ThemeMode` -- current theme detected from DOM class

---

### useTimeEntries(date?)

- **File:** `client/src/hooks/useTimeEntries.ts`
- **Tables:** `timeEntries`
- **Store dependency:** Reads `settingsStore.dayStartHour` for logical date
- **Reactive query:** `db.timeEntries.where('date').equals(targetDate).filter(e => !e.deletedAt).toArray()` where `targetDate` defaults to `getLogicalDate(dayStartHour)`
- **Dependencies:** `[targetDate]`
- **Returns:**
  - `entries: TimeEntry[]`
  - `addManualEntry(activityId, durationSeconds, entryDate?)` -- creates a manual time entry with `isManual=true`, `startedAt=endedAt=now`, specified date or logical today
  - `deleteEntry(id)` -- soft delete
  - `getElapsedForActivity(activityId): number` -- filters current entries and sums `durationSeconds`
- **Side effects:** None.

---

### useTimer()

- **File:** `client/src/hooks/useTimer.ts`
- **Tables:** None directly (timerStore handles Dexie)
- **Store dependencies:** `timerStore`, `settingsStore`
- **Worker:** Uses a **module-level singleton** `timer.worker.ts` instance. Worker receives `startedAt` timestamp and computes elapsed seconds each tick. Worker `onmessage` calls `timerStore.tick(elapsed)`.
- **Returns:**
  - `isRunning`, `activeActivityId`, `elapsed` (from timerStore)
  - `startTimer(activityId)` -- calls `timerStore.start(activityId, dayStartHour)`
  - `stopTimer()` -- calls `timerStore.stop()`
  - `toggleTimer(activityId)` -- if running same activity, stops; otherwise starts
- **Notification side effect:** Sends browser `Notification` at intervals of `timerNotificationIntervalMinutes` while running.
- **Visibility change side effect:** On `document.visibilitychange` to `'visible'`, recalculates elapsed from `startedAt` timestamp. This handles mobile backgrounding where the worker may be throttled.
- **Restore side effect:** Calls `timerStore.restore()` on mount to resume interrupted timers.
- **Worker lifecycle:** Posts `{ type: 'start', startedAt }` when running, `{ type: 'stop' }` otherwise.

---

### useTodayTasks()

- **File:** `client/src/hooks/useTodayTasks.ts`
- **Tables:** `todayTasks`, `projectTasks` (join + write-through), `projects` (join)
- **Reactive query:** Complex enrichment query:
  1. Loads `todayTasks.where('date').equals(today).filter(!deletedAt)`
  2. For each todayTask, loads the linked `projectTask` and `project`
  3. Skips entries where projectTask or project is deleted
  4. Enriches with `taskTitle`, `projectName`, `projectColor`, `linkedActivityId`
  5. Sorts by `sortOrder`
- **Dependencies:** `[date]` (today's YYYY-MM-DD)
- **Returns:**
  - `todayTasks: EnrichedTodayTask[]` -- TodayTask + `taskTitle`, `projectName`, `projectColor`, `linkedActivityId`
  - `addToToday(projectTaskId, projectId)` -- deduplicates (checks if already added for today), creates todayTask entry
  - `removeFromToday(id)` -- soft delete
  - `toggleToday(projectTaskId, projectId)` -- add if not present, remove if present
  - `completeTask(id)` -- toggles `isCompleted` on todayTask AND **writes through** to the underlying `projectTask` (syncs completion status both ways). Awards XP on completion.
  - `reorderTodayTasks(orderedIds)` -- sets `sortOrder=index` for each ID
  - `updateTaskTitle(todayTaskId, newTitle)` -- reads todayTask to find `projectTaskId`, writes title to the underlying `projectTask`
  - `date: string` -- today's YYYY-MM-DD
- **Side effects:** Write-through to `projectTasks` on complete and title update. XP on complete.

---

## Store Reference

### timerStore

- **File:** `client/src/stores/timerStore.ts`
- **Type:** Zustand store (no persistence middleware -- manages Dexie directly)
- **Persistence:** Writes to `db.timeEntries` on `start()` (creates entry) and `stop()` (updates endedAt + durationSeconds)

#### State Fields

| Field | Type | Description |
|-------|------|-------------|
| `activeEntryId` | `string \| null` | ID of current timeEntry record in Dexie |
| `activeActivityId` | `string \| null` | Which activity is being timed |
| `startedAt` | `string \| null` | ISO timestamp when timer started |
| `elapsed` | `number` | Current elapsed seconds (updated by worker ticks) |
| `isRunning` | `boolean` | Whether timer is active |

#### Actions

| Action | What It Does |
|--------|-------------|
| `start(activityId, dayStartHour)` | Stops current timer if running. Creates a new `timeEntry` in Dexie with `endedAt=null, durationSeconds=0`. Sets all state fields. |
| `stop()` | Calculates `durationSeconds` from `startedAt` to now. Updates the Dexie `timeEntry` with `endedAt` and `durationSeconds`. Awards XP if >= 60 seconds. Resets all state. |
| `tick(elapsed)` | Sets `elapsed` to given value. Pure state update, no Dexie write. |
| `restore()` | Queries Dexie for any `timeEntry` where `endedAt === null && !deletedAt`. If found, restores timer state from that entry. Called on app load. |

#### Consumers

- `useTimer()` hook -- primary consumer, manages worker lifecycle
- `usePomodoro()` hook -- starts/stops timer based on pomodoro phase transitions
- `useTaskTimer()` hook -- starts/stops timer for task countdown activity linking

---

### pomodoroStore

- **File:** `client/src/stores/pomodoroStore.ts`
- **Type:** Zustand store (ephemeral -- no persistence)
- **Persistence:** None. Pomodoro state is lost on page refresh.

#### State Fields

| Field | Type | Description |
|-------|------|-------------|
| `isActive` | `boolean` | Whether a pomodoro session is running |
| `isPaused` | `boolean` | Whether currently paused |
| `phase` | `PomodoroPhase` | `'work' \| 'break' \| 'longBreak'` |
| `remainingSeconds` | `number` | Seconds left in current phase |
| `totalSeconds` | `number` | Total seconds for current phase (for progress calculation) |
| `currentSession` | `number` | Which work session (1-based) |
| `workMinutes` | `number` | Config: work phase duration |
| `breakMinutes` | `number` | Config: short break duration |
| `longBreakMinutes` | `number` | Config: long break duration |
| `sessionsBeforeLongBreak` | `number` | Config: N sessions before long break |
| `autoStartBreaks` | `boolean` | Config: auto-start breaks |
| `autoStartWork` | `boolean` | Config: auto-start next work |
| `linkedActivityId` | `string \| null` | Activity to auto-start/stop with work phases |
| `selectedPresetId` | `string \| null` | Which preset is selected |

#### Actions

| Action | What It Does |
|--------|-------------|
| `startSession(config)` | Initializes all state from PomodoroConfig. Sets phase='work', remainingSeconds=workMinutes*60. |
| `pause()` | Sets `isPaused=true` |
| `resume()` | Sets `isPaused=false` |
| `stop()` | Resets all session state to defaults |
| `skip()` | Calls `advancePhase()` immediately |
| `tick()` | Decrements `remainingSeconds`. When reaching 0, calls `advancePhase()`. |
| `setLinkedActivity(id)` | Sets `linkedActivityId` |
| `setSelectedPreset(id)` | Sets `selectedPresetId` |

#### Phase Advancement Logic (`advancePhase()`)

```
work --> break (if currentSession < sessionsBeforeLongBreak)
     \-> longBreak (if currentSession >= sessionsBeforeLongBreak)

break --> work (currentSession + 1)
longBreak --> work (currentSession reset to 1)
```

On transition to break/longBreak: `isPaused = !autoStartBreaks`
On transition to work: `isPaused = !autoStartWork`

#### Consumers

- `usePomodoro()` hook -- the only consumer

---

### settingsStore

- **File:** `client/src/stores/settingsStore.ts`
- **Type:** Zustand store with manual Dexie persistence
- **Persistence:** Writes to `db.settings` (id='default') on every `update()` call

#### State Fields

All fields from `DEFAULT_SETTINGS` in `shared/constants.ts`, plus:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dayStartHour` | `number` | `6` | Logical day start hour |
| `dayEndHour` | `number` | `2` | Logical day end hour |
| `timezone` | `string` | auto-detected | User timezone |
| `barStyle` | `BarStyle` | `'thick-linear'` | Progress bar style |
| `theme` | `ThemeMode` | `'light'` | Current theme |
| `language` | `Language` | auto-detected | UI language |
| `syncEnabled` | `boolean` | `false` | Server sync on/off |
| `syncServerUrl` | `string` | `''` | Sync server URL |
| `syncApiKey` | `string` | `''` | Sync API key |
| `maxTasksPerProject` | `number` | `5` | Task limit per project |
| `navPosition` | `string` | `'left'` | Navigation mode |
| `timerNotificationsEnabled` | `boolean` | `false` | Timer notification toggle |
| `timerNotificationIntervalMinutes` | `number` | `30` | Notification interval |
| `pointsCounterVisible` | `boolean` | `true` | Show staleness counter |
| `accentColor` | `string` | `''` | Override accent color |
| `uiZoom` | `number` | `110` | UI zoom percentage |
| `customThemeColors` | `CustomThemeColors` | (dark theme) | Custom theme color map |
| `procrastinationWords` | `string[]` | (Russian words) | Procrastination detection keywords |
| `dismissedProcrastinationTaskIds` | `string[]` | `[]` | Dismissed procrastination warnings |
| `vaultEnabled` | `boolean` | `false` | Vault feature toggle |
| `vaultPath` | `string` | `''` | Vault file path |
| `vaultSetupDone` | `boolean` | `false` | Vault setup completed |
| `taskTimerMinutes` | `number` | `20` | Task countdown duration |
| `currentStreak` | `number` | `0` | Gamification: current streak |
| `longestStreak` | `number` | `0` | Gamification: longest streak |
| `lastActiveDate` | `string` | `''` | Gamification: last active date |
| `totalXP` | `number` | `0` | Gamification: total XP |
| `todayXP` | `number` | `0` | Gamification: today's XP |
| `todayXPDate` | `string` | `''` | Gamification: date for today's XP |
| `gamificationEnabled` | `boolean` | `true` | Gamification toggle |
| `loaded` | `boolean` | `false` | Whether settings have been loaded from Dexie |

#### Actions

| Action | What It Does |
|--------|-------------|
| `load()` | Reads `db.settings.get('default')`. Migrates legacy fields (`darkMode` boolean, `'notion'` theme). Falls back to defaults for any missing field. Applies theme, accent color, and zoom to DOM. Sets `loaded=true`. |
| `update(patch)` | Merges patch into Zustand state. If `theme` changed: applies theme class + accent to DOM. If `customThemeColors` changed and theme is custom: applies CSS vars. If `accentColor` changed: applies accent override. If `uiZoom` changed: applies zoom. Then writes entire patch to `db.settings.update('default', { ...patch, updatedAt })`. |

#### DOM Side Effects

The settingsStore directly manipulates the DOM on theme/accent/zoom changes:

1. **Theme:** Removes all theme classes from `<html>`, adds the new one. For custom theme, sets 12 `--color-*` CSS properties via `element.style.setProperty()`.
2. **Accent color:** Sets/removes `--color-accent` CSS property on `<html>`.
3. **Zoom:** Sets `font-size` on `<html>` as percentage.

#### Consumers

- Almost every component reads at least one setting
- `useTimer()` reads `dayStartHour`, `timerNotificationsEnabled`, `timerNotificationIntervalMinutes`
- `useTimeEntries()` reads `dayStartHour`
- `usePointsCounter()` reads `pointsCounterVisible`
- `useTaskTimer()` reads `taskTimerMinutes`, `dayStartHour`
- `usePomodoro()` reads `dayStartHour` (via `useSettingsStore.getState()`)
- `useThemeColors()` reads `customThemeColors`
- `useDayBoundary()` reads `dayStartHour`
- `awardXP()` reads and writes gamification fields
- All settings UI components

---

### taskTimerStore

- **File:** `client/src/stores/taskTimerStore.ts`
- **Type:** Zustand store (ephemeral -- no persistence)
- **Persistence:** None. Task timer state is lost on page refresh.

#### State Fields

| Field | Type | Description |
|-------|------|-------------|
| `activeTaskId` | `string \| null` | ID of the todayTask being timed |
| `linkedActivityId` | `string \| null` | Activity linked to the project (for timerStore integration) |
| `remainingSeconds` | `number` | Countdown seconds remaining |
| `totalSeconds` | `number` | Total seconds for this countdown |
| `isActive` | `boolean` | Whether countdown is running |
| `isPaused` | `boolean` | Whether paused |
| `countdownComplete` | `boolean` | Whether countdown reached zero |
| `overtimeSeconds` | `number` | Seconds elapsed after countdown completed (counts up) |

#### Actions

| Action | What It Does |
|--------|-------------|
| `start(config)` | Sets all state from config. Resets `countdownComplete=false`, `overtimeSeconds=0`. |
| `pause()` | Sets `isPaused=true` |
| `resume()` | Sets `isPaused=false` |
| `stop()` | Resets all state to defaults |
| `tick()` | If `remainingSeconds > 0`: decrements. If reaching 0: sets `countdownComplete=true`. If already at 0: increments `overtimeSeconds`. |

#### Consumers

- `useTaskTimer()` hook -- the only consumer

---

### projectUIStore

- **File:** `client/src/stores/projectUIStore.ts`
- **Type:** Zustand store (ephemeral -- no persistence)
- **Persistence:** None. Tab state is lost on page refresh.

#### State Fields

| Field | Type | Description |
|-------|------|-------------|
| `openTabs` | `string[]` | List of open project IDs (tab bar) |
| `activeTabId` | `string \| null` | Currently focused tab |
| `sidebarCollapsed` | `boolean` | Project sidebar collapsed state |
| `splitDirection` | `'vertical' \| 'horizontal'` | Editor split direction |

#### Actions

| Action | What It Does |
|--------|-------------|
| `openTab(id)` | Adds ID to `openTabs` if not present, sets as active. If already open, just sets active. |
| `closeTab(id)` | Removes from `openTabs`. If closing active tab, activates nearest remaining tab. |
| `setActiveTab(id)` | Sets `activeTabId` |
| `toggleSidebar()` | Flips `sidebarCollapsed` |
| `setSplitDirection(dir)` | Sets `splitDirection` |

#### Consumers

- `ProjectsView` component
- `FileTree` component
- `ProjectDraftEditor` component

---

### mindMapUIStore

- **File:** `client/src/stores/mindMapUIStore.ts`
- **Type:** Zustand store (ephemeral -- no persistence)
- **Persistence:** None.

#### State Fields

| Field | Type | Description |
|-------|------|-------------|
| `activeMindMapId` | `string \| null` | Currently viewed mind map |
| `selectedNodeId` | `string \| null` | Currently selected node |
| `mindUnloadActive` | `boolean` | Mind Unload mode active |
| `timerVisible` | `boolean` | Focus countdown timer visible |
| `pendingEditNodeId` | `string \| null` | Node pending text edit |

#### Actions

| Action | What It Does |
|--------|-------------|
| `setActiveMindMap(id)` | Sets `activeMindMapId`, clears `selectedNodeId` |
| `setSelectedNode(id)` | Sets `selectedNodeId` |
| `setMindUnloadActive(active)` | Sets `mindUnloadActive` |
| `setTimerVisible(visible)` | Sets `timerVisible` |
| `setPendingEditNode(id)` | Sets `pendingEditNodeId` |

#### Consumers

- `MindMapView` component
- `MindMapCanvas` component
- `MindMapNode` component
- `MindMapToolbar` component
- `MindUnloadMode` component

---

## Worker Reference

### timer.worker.ts

- **File:** `client/src/workers/timer.worker.ts`
- **Protocol:**
  - Receives: `{ type: 'start', startedAt: string }` or `{ type: 'stop' }`
  - Posts: `{ type: 'tick', elapsed: number }` every 1 second
- **Behavior:** On `'start'`, records `startedAt` timestamp and starts a 1-second `setInterval`. Each tick computes `elapsed = Math.floor((Date.now() - startTime) / 1000)` and posts it. Sends an immediate tick on start. On `'stop'`, clears the interval.
- **Key design:** Elapsed is computed from the absolute start time, not incremented. This means if ticks are delayed (e.g., background tab throttling), the elapsed value self-corrects on the next tick.
- **Singleton pattern:** Module-level variable in `useTimer()` ensures only one worker instance exists across React re-mounts.

### pomodoro.worker.ts

- **File:** `client/src/workers/pomodoro.worker.ts`
- **Protocol:**
  - Receives: `{ type: 'start' }` or `{ type: 'stop' }`
  - Posts: `{ type: 'tick' }` every 1 second
- **Behavior:** On `'start'`, starts a 1-second `setInterval` that posts a bare `'tick'` message. No elapsed calculation -- the store handles countdown decrement. On `'stop'`, clears the interval.
- **Key design:** Unlike timer.worker, this worker does NOT track elapsed time. It simply fires a tick signal and the consuming store (pomodoroStore or taskTimerStore) decrements its own counter.
- **Reused by:** Both `usePomodoro()` and `useTaskTimer()` create separate instances of this same worker file.

---

## Feature Data Flows

### Timer Flow (Activity Time Tracking)

The core feature. User tracks time spent on activities.

```
1. User taps an activity card on HomePage
   |
   v
2. TimerDisplay component calls useTimer().toggleTimer(activityId)
   |
   v
3. If already running same activity: calls timerStore.stop()
   |    - Calculates durationSeconds from startedAt to now
   |    - Updates db.timeEntries[activeEntryId].endedAt and .durationSeconds
   |    - Awards XP if duration >= 60s
   |    - Resets store state
   |    - Worker receives 'stop' message, clears interval
   |
   v (else: starting)
4. timerStore.start(activityId, dayStartHour)
   |    - If another timer was running, stops it first (step 3)
   |    - Creates new timeEntry in Dexie: { endedAt: null, durationSeconds: 0, date: getLogicalDate() }
   |    - Sets store state: isRunning=true, activeEntryId, activeActivityId, startedAt
   |
   v
5. useTimer() useEffect detects isRunning=true
   |    - Posts { type: 'start', startedAt } to timer.worker
   |    - Requests notification permission if enabled
   |
   v
6. timer.worker starts 1-second interval
   |    - Each tick: posts { type: 'tick', elapsed: <computed from startedAt> }
   |
   v
7. useTimer() worker.onmessage handler
   |    - Calls timerStore.tick(elapsed) -- updates store.elapsed
   |    - Checks notification interval, sends Notification if due
   |
   v
8. Component re-renders via Zustand selector on timerStore.elapsed
   |    - TimerDisplay shows formatted elapsed time
   |
   v
9. When user stops: back to step 3
   |    - The timeEntry is finalized in Dexie
   |    - useLiveQuery in useTimeEntries() detects the change
   |    - Activity cards, analytics, etc. re-render with new data
```

**Visibility change recovery:**
- When tab becomes visible after background, `useTimer()` recalculates elapsed from `startedAt` directly (not relying on worker ticks that may have been throttled).

**App reload recovery:**
- `timerStore.restore()` scans for `timeEntries` where `endedAt === null`. If found, reconstructs timer state and resumes the worker.

---

### Manual Time Entry Flow

```
1. User opens ManualEntry component on HomePage
   |
   v
2. User selects activity, enters duration, optionally sets date
   |
   v
3. Component calls useTimeEntries().addManualEntry(activityId, durationSeconds, date?)
   |
   v
4. Hook creates timeEntry in Dexie:
   |    { isManual: true, startedAt: now, endedAt: now, durationSeconds, date: getLogicalDate() }
   |
   v
5. useLiveQuery in useTimeEntries() detects new entry
   |
   v
6. Activity cards and analytics re-render with updated totals
```

---

### Pomodoro Flow

```
1. User selects a preset and optionally links an activity
   |    - usePomodoroPresets().presets provides options
   |    - pomodoroStore.setLinkedActivity(activityId) sets the link
   |    - pomodoroStore.setSelectedPreset(presetId) remembers selection
   |
   v
2. User clicks Start
   |    - usePomodoro().startPomodoro(preset)
   |    - pomodoroStore.startSession(config) initializes: phase='work', remainingSeconds=workMinutes*60
   |    - Requests notification permission
   |
   v
3. usePomodoro() useEffect detects isActive && !isPaused
   |    - Posts 'start' to pomodoro.worker
   |    - If linkedActivityId set: starts timerStore for that activity
   |
   v
4. Worker ticks every 1 second
   |    - pomodoroStore.tick() decrements remainingSeconds
   |    - Component re-renders with countdown display
   |
   v
5. remainingSeconds reaches 0 --> advancePhase()
   |
   +---> From 'work': transition to 'break' or 'longBreak'
   |     |    - Sets isPaused=!autoStartBreaks
   |     |    - usePomodoro() useEffect detects phase changed from 'work'
   |     |    - Stops timerStore if linked activity was running
   |     |    - Sends browser Notification ("Break time!")
   |     v
   |     Worker continues (or pauses if isPaused)
   |
   +---> From 'break'/'longBreak': transition to 'work'
         |    - Sets isPaused=!autoStartWork
         |    - currentSession increments (or resets to 1 after longBreak)
         |    - usePomodoro() useEffect detects phase='work'
         |    - Starts timerStore for linked activity
         |    - Sends browser Notification ("Work time!")
         v
         Cycle continues...

6. User clicks Stop
   |    - usePomodoro().stop()
   |    - Stops linked activity timer via timerStore.stop()
   |    - pomodoroStore.stop() resets all state
   |    - Worker receives 'stop'
```

---

### Task Timer Flow (Today Task Countdown)

```
1. User is on Today page with enriched tasks
   |    - useTodayTasks() provides EnrichedTodayTask[] with linkedActivityId from project
   |
   v
2. User clicks timer icon on a today task
   |    - Calls useTaskTimer().startTask(todayTaskId, projectId, linkedActivityId)
   |
   v
3. useTaskTimer hook:
   |    - Stops any existing task timer (stopTask())
   |    - Calculates totalSeconds = settingsStore.taskTimerMinutes * 60
   |    - taskTimerStore.start({ taskId, linkedActivityId, totalSeconds })
   |    - If linkedActivityId exists: timerStore.start(linkedActivityId, dayStartHour)
   |      (This creates a timeEntry in Dexie and starts the activity timer)
   |
   v
4. useEffect detects isActive=true
   |    - Posts 'start' to pomodoro.worker (reused for countdown)
   |
   v
5. Worker ticks every 1 second
   |    - taskTimerStore.tick() decrements remainingSeconds
   |    - When remainingSeconds hits 0: sets countdownComplete=true
   |    - After 0: increments overtimeSeconds (timer continues counting up)
   |
   v
6. useEffect detects countdownComplete=true
   |    - Sends browser Notification ("Task Timer Complete")
   |
   v
7. User clicks stop (or task auto-completes)
   |    - useTaskTimer().stopTask()
   |    - If linkedActivityId running in timerStore: stops it (finalizes timeEntry)
   |    - taskTimerStore.stop() resets all state
   |    - Worker receives 'stop'
```

---

### Project CRUD Flow

```
CREATE:
1. User fills project form in ProjectsView
2. useProjects().createProject({ name, color, description, folderId, linkedActivityId })
3. Hook: db.projects.add(project) with UUID v7 + awardXP
4. useLiveQuery detects change --> project list re-renders

DELETE (with cascade):
1. User confirms project deletion
2. useProjects().deleteProject(id)
3. Hook: db.projects.update(id, { deletedAt }) -- soft delete project
4. Hook: queries db.projectTasks.where('projectId').equals(id) -- finds all tasks
5. Hook: soft-deletes each task
6. Hook: queries db.todayTasks.where('projectId').equals(id) -- finds all today tasks
7. Hook: soft-deletes each today task
8. Multiple useLiveQuery hooks detect changes:
   - useProjects() re-renders project list
   - useProjectTasks() re-renders task list
   - useTodayTasks() re-renders today view
   - useAllProjectTasks() re-renders task selection view
```

---

### Task CRUD Flow (within a project)

```
CREATE:
1. User types task in ProjectDraftEditor
2. useProjectTasks(projectId).createTask(title, recurrenceRule?)
3. Hook: db.projectTasks.add(task) with UUID v7 + awardXP
4. useLiveQuery detects change --> task list re-renders

TOGGLE COMPLETE:
1. User checks/unchecks task
2. useProjectTasks(projectId).toggleTask(id)
3. Hook: reads task, flips isCompleted, updates Dexie
4. If completing + has recurrenceRule:
   a. Creates NEW task with same title/recurrence, isCompleted=false
   b. Sets lastRecurredDate=today on new task
5. If completing: awardXP
6. useLiveQuery detects changes --> task list re-renders

DELETE (with cascade):
1. User deletes task
2. useProjectTasks(projectId).deleteTask(id)
3. Hook: soft-deletes projectTask
4. Hook: queries todayTasks.where('projectTaskId').equals(id) -- finds references
5. Hook: soft-deletes each matching todayTask
```

---

### Today Tasks Flow

```
ADD TO TODAY:
1. User selects a task from TaskSelectionPage or toggles on Today page
2. useTodayTasks().addToToday(projectTaskId, projectId)
   OR useTodayTasks().toggleToday(projectTaskId, projectId)
3. Hook: checks for duplicate (same projectTaskId + date)
4. Hook: creates todayTask with UUID v7, date=today, sortOrder=count
5. useLiveQuery detects change --> enriched task list re-renders
   (enrichment joins: projectTasks for title, projects for name/color/linkedActivityId)

COMPLETE:
1. User checks task on Today page
2. useTodayTasks().completeTask(id)
3. Hook: toggles isCompleted on todayTask
4. Hook: WRITE-THROUGH to projectTask (same isCompleted + completedAt)
5. If completing: awardXP
6. Multiple useLiveQuery hooks detect changes in both tables

TITLE UPDATE:
1. User edits task title on Today page
2. useTodayTasks().updateTaskTitle(todayTaskId, newTitle)
3. Hook: reads todayTask to get projectTaskId
4. Hook: updates title on the underlying projectTask (not the todayTask)
5. useLiveQuery in both useTodayTasks and useProjectTasks detects change
```

---

### Folder Flow

```
CREATE:
1. User creates folder in FileTree
2. useFolders().createFolder(name, color?, parentFolderId?)
3. Hook: db.projectFolders.add(folder)
4. useLiveQuery re-renders FileTree

DELETE:
1. User deletes folder
2. useFolders().deleteFolder(id)
3. Hook: soft-deletes folder
4. Hook: queries projects.where('folderId').equals(id)
5. Hook: sets folderId=null on each child project (reparent to root)
   (Does NOT delete the projects, just moves them out of the folder)
```

---

### Habits Flow

```
TOGGLE BOOLEAN:
1. User taps habit checkbox for a date
2. useHabits().toggleBooleanHabit(habitId, date)
3. Hook: queries habitEntries using compound index [habitId+date]
4. If entry exists: toggles value 0<->1, updates completed
5. If no entry: creates new entry with value=1, completed=true
6. Awards XP on completion
7. useLiveQuery on weekEntries detects change
8. useEffect recalculates streaks for all habits
9. Component re-renders with updated grid + streak count

LOG NUMERIC:
1. User increments/decrements numeric habit
2. useHabits().logNumericHabit(habitId, date, value)
3. Hook: reads habit to get targetValue
4. Hook: queries habitEntries using compound index [habitId+date]
5. If entry exists: adds value (clamped to 0), checks completed = (value >= targetValue)
6. If no entry: creates with given value
7. Awards XP on first reaching target
```

---

### Notes Flow

```
Standard CRUD with pin toggle:
1. useNotes() provides reactive query sorted by isPinned desc, updatedAt desc
2. createNote, updateNote, deleteNote follow standard pattern
3. togglePin reads current note, flips isPinned
4. All mutations trigger useLiveQuery re-render
5. createNote awards XP
```

---

### Inbox Flow

```
Standard CRUD:
1. useInbox() provides reactive query sorted by createdAt desc (newest first)
2. addItem(text) creates item + awards XP, returns item
3. updateItem(id, text) updates text
4. deleteItem(id) soft delete
```

---

### Mind Map Flow

```
CREATE:
1. User creates new mind map
2. useMindMaps().createMindMap(title)
3. Hook: creates MindMap with single root node (flat array: [{ id, text, children: [] }])
4. Hook: awards XP, returns created map

NODE OPERATIONS (all require full read + full write of nodes array):
1. User adds/edits/deletes a node
2. Hook reads entire MindMap from Dexie
3. Hook maps over nodes[] array to apply change
4. Hook writes entire updated nodes[] back to Dexie
5. useLiveQuery detects mindMap record changed, re-renders canvas

ADD NODE:
1. addNode(mindMapId, parentNodeId, text, direction?)
2. Reads mindMap, creates newNode, adds newNode.id to parent.children[], pushes newNode to nodes[]

DELETE NODE (recursive):
1. deleteNode(mindMapId, nodeId)
2. Reads mindMap, refuses if nodeId === rootNodeId
3. Recursively collects all descendant IDs via children[] traversal
4. Filters nodes[] to remove all collected IDs
5. Removes collected IDs from all remaining nodes' children[] arrays
```

---

### PDF Documents Flow

```
Standard CRUD with pin toggle:
1. usePdfDocuments() provides reactive query sorted by isPinned desc, updatedAt desc
2. createPdf stores actual Blob data (pdfData + thumbnail) in IndexedDB
3. togglePin flips isPinned
4. No XP awarded
```

---

### Settings Flow

```
READ (app startup):
1. App mounts, calls settingsStore.load()
2. Store reads db.settings.get('default')
3. Migrates legacy fields (darkMode -> theme, 'notion' -> 'dark')
4. Falls back to DEFAULT_SETTINGS for any missing field
5. Applies theme class to <html>, applies accent color CSS var, applies zoom font-size
6. Sets loaded=true, components render with settings

UPDATE:
1. User changes a setting in SettingsPage
2. Component calls settingsStore.update({ fieldName: newValue })
3. Store merges patch into Zustand state (immediate re-render)
4. Store applies DOM side effects if needed:
   - theme change: removes old class, adds new class, applies custom CSS vars
   - customThemeColors change: sets 12+ CSS properties on <html>
   - accentColor change: sets --color-accent CSS property
   - uiZoom change: sets font-size on <html>
5. Store writes patch + updatedAt to db.settings.update('default', ...)
```

---

### Recurring Task Auto-Creation Flow

Two paths exist for creating recurring task instances:

**Path 1: On completion (useProjectTasks.toggleTask)**
```
1. User marks a recurring task as complete
2. toggleTask detects task.recurrenceRule is non-null
3. Creates new incomplete task clone: same title + recurrenceRule
4. New task gets lastRecurredDate = today
```

**Path 2: On app mount (useRecurringTaskCheck)**
```
1. App mounts, hook runs once
2. Scans all completed tasks with non-null recurrenceRule
3. For each: calls shouldCreateRecurrence(lastRecurredDate, rule, today)
4. If due: checks for existing incomplete duplicate (same title + project)
5. If no duplicate: creates new instance, updates original's lastRecurredDate
```

The two paths are complementary:
- Path 1 handles immediate recurrence on completion
- Path 2 handles recurrences that became due while the app was closed

---

### Points/Staleness Counter Flow

```
1. usePointsCounter() queries all incomplete projectTasks
2. useEffect computes staleness score every 60 seconds:
   score = sum( (ageDays)^2 ) for each incomplete task
   where ageDays = (now - createdAt) / 86400000
3. Returns totalScore, visibility from settings
4. toggleVisibility writes to settingsStore --> Dexie
```

---

### Day Boundary Flow

```
1. useDayBoundary(onDayChange) sets 60-second interval
2. Checks: current hour === settingsStore.dayStartHour AND minutes === 0
3. If true: calls onDayChange callback
4. Used to refresh daily data (today tasks, analytics) at day boundary
```

---

### Theme Detection Flow (for Charts)

```
1. useThemeColors() uses useSyncExternalStore with MutationObserver
2. Observer watches <html> classList changes
3. getThemeSnapshot() reads classList to determine current ThemeMode
4. Returns hardcoded hex colors per theme, or customThemeColors from settingsStore for 'custom'
5. Recharts components use these colors for consistent chart styling
```

---

## Sync Data Flow

### Overview

- **Strategy:** Pull-before-push with Last-Write-Wins (LWW) conflict resolution
- **Scope:** Only `activities`, `timeEntries`, and `settings` are synced. All other data is local-only.
- **Trigger:** Manual (called by UI). Not automatic.

### Client-Side (syncEngine.ts)

```
syncNow() is called:
    |
    v
1. Check settings: syncEnabled && syncServerUrl
   |    (abort if not configured)
   |
   v
2. PULL: GET /api/sync/changes?since={lastSyncedAt}
   |    - Server returns all records with updatedAt > since
   |
   v
3. Apply server changes locally (LWW per record):
   |    For each activity in response:
   |      - Read local: db.activities.get(activity.id)
   |      - If !local OR server.updatedAt > local.updatedAt: db.activities.put(activity)
   |    For each timeEntry in response: same pattern
   |    For settings: same pattern (single record, id='default')
   |
   v
4. PUSH: Collect local changes since lastSyncedAt
   |    - db.activities.filter(a => a.updatedAt > lastSyncedAt)
   |    - db.timeEntries.filter(e => e.updatedAt > lastSyncedAt)
   |    - db.settings.get('default') if updatedAt > lastSyncedAt
   |
   v
5. POST /api/sync/changes with SyncPayload
   |
   v
6. Update lastSyncedAt = serverTime from response
```

### Server-Side

**GET /api/sync/changes?since=ISO8601:**
```
1. Query SQLite: SELECT * FROM activities WHERE updatedAt > ?
2. Query SQLite: SELECT * FROM time_entries WHERE updatedAt > ?
3. Query SQLite: SELECT * FROM user_settings WHERE updatedAt > ? LIMIT 1
4. Convert SQLite integers to JS booleans (isBreak, isManual, syncEnabled)
5. Return { activities, timeEntries, settings, serverTime }
```

**POST /api/sync/changes (SyncPayload):**
```
1. Wrapped in SQLite transaction
2. For each activity: INSERT ... ON CONFLICT(id) DO UPDATE SET
   - Each field uses: CASE WHEN excluded.updatedAt > table.updatedAt THEN excluded.value ELSE table.value END
   - This is per-record LWW at the SQL level
3. For each timeEntry: same pattern
4. For settings: same pattern (subset of fields: dayStartHour, dayEndHour, timezone, barStyle, syncEnabled, syncServerUrl, syncApiKey)
5. Return { status: 'ok', serverTime }
```

### Authentication

- Optional API key via `X-API-Key` header
- Server middleware: `authMiddleware` validates against configured key
- If no key configured on server, all requests pass through

### Sync Limitations

| What Syncs | What Does NOT Sync |
|------------|-------------------|
| Activities | Habits + HabitEntries |
| TimeEntries | Notes |
| Settings (partial: day boundary, timezone, barStyle, sync config) | PomodoroPresets |
| | Projects, ProjectTasks, TodayTasks |
| | ProjectFolders |
| | InboxItems |
| | MindMaps |
| | PdfDocuments |
| | Theme, language, UI preferences |
| | Gamification state |

---

## Gamification / XP System

### Overview

A cross-cutting system that awards XP for productive actions and tracks daily streaks.

### Data Storage

All gamification state lives in `settingsStore` (persisted to Dexie settings table):
- `gamificationEnabled: boolean` -- master toggle
- `currentStreak: number` -- consecutive active days
- `longestStreak: number` -- all-time record
- `lastActiveDate: string` -- YYYY-MM-DD
- `totalXP: number` -- cumulative XP
- `todayXP: number` -- XP earned today
- `todayXPDate: string` -- which date todayXP is for

### XP Values

| Action | XP | Trigger Location |
|--------|----|-----------------|
| Complete task | 15 | `useProjectTasks.toggleTask`, `useTodayTasks.completeTask` |
| Check habit | 10 | `useHabits.toggleBooleanHabit`, `useHabits.logNumericHabit` |
| Stop timer (>=60s) | 10 | `timerStore.stop` |
| Create note | 10 | `useNotes.createNote` |
| Create task | 5 | `useProjectTasks.createTask` |
| Add inbox item | 5 | `useInbox.addItem` |
| Create mind map | 5 | `useMindMaps.createMindMap` |
| Create project | 5 | `useProjects.createProject` |

### awardXP() Flow

```
1. Any hook/store calls awardXP(amount)
2. awardXP reads settingsStore state
3. If !gamificationEnabled: return (no-op)
4. Compute logical today via getLogicalDate(dayStartHour)
5. If todayXPDate !== today: reset todayXP to 0, update todayXPDate
6. Update streak:
   - If lastActiveDate === today: no streak change (same day)
   - If lastActiveDate === yesterday: currentStreak += 1
   - Else: currentStreak = 1 (streak broken)
7. Add amount to totalXP and todayXP
8. Update longestStreak if currentStreak exceeds it
9. Write all fields via settingsStore.update() --> Dexie
```

### Level Calculation

```
level = Math.floor(Math.sqrt(totalXP / 100)) + 1
```

XP needed per level: `level^2 * 100` (quadratic growth).

---

## Cross-Cutting Patterns

### Standard CRUD Hook Pattern

Every data hook follows this pattern:

```typescript
export function useXxx() {
  // 1. Reactive query
  const data = useLiveQuery(
    () => db.table.filter(x => !x.deletedAt).[sortBy/toArray](),
    [dependencies],
  );

  // 2. Create: generateId(), getDeviceId(), timestamps, db.table.add()
  const createXxx = async (input) => {
    const now = new Date().toISOString();
    await db.table.add({
      id: generateId(),        // UUID v7 (time-sortable)
      ...input,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(), // localStorage-backed device fingerprint
    });
    awardXP(XP_VALUES.xxx);   // If applicable
  };

  // 3. Update: partial patch + updatedAt
  const updateXxx = async (id, patch) => {
    await db.table.update(id, { ...patch, updatedAt: new Date().toISOString() });
  };

  // 4. Delete: soft delete (set deletedAt, never hard delete)
  const deleteXxx = async (id) => {
    const now = new Date().toISOString();
    await db.table.update(id, { deletedAt: now, updatedAt: now });
    // Optional: cascade soft-delete related records
  };

  return { data: data ?? [], createXxx, updateXxx, deleteXxx };
}
```

### Soft Delete Convention

- All entities have `deletedAt: string | null`
- Delete operations set `deletedAt` to current ISO timestamp
- All queries filter `!deletedAt`
- Records are never physically removed from IndexedDB
- Cascade deletes are handled in hooks, not at the database level

### Cascade Delete Map

| When Deleting | Also Soft-Deletes |
|---------------|-------------------|
| Project | All its ProjectTasks + all TodayTasks referencing that project |
| ProjectTask | All TodayTasks referencing that task |
| Folder | **Nothing** (child projects are reparented to root, not deleted) |
| Habit | **Nothing** (habitEntries are NOT cascade-deleted) |
| Activity | **Nothing** (timeEntries are NOT cascade-deleted) |
| MindMap | **Nothing** (nodes are inline in the record) |
| Note | **Nothing** |
| InboxItem | **Nothing** |

### Reactive Data Flow Pattern

```
Dexie Write (any mutation via hook)
    |
    v
IndexedDB onChange event
    |
    v
Dexie useLiveQuery() observer fires
    |
    v
React component re-renders with new data
```

This is automatic -- any Dexie table mutation triggers re-evaluation of all `useLiveQuery()` hooks that touch that table. No manual invalidation needed.

### Store vs Hook Decision Matrix

| Data Type | Mechanism | Why |
|-----------|-----------|-----|
| Persisted entities (activities, tasks, etc.) | Hook + useLiveQuery | Data lives in Dexie, reactive queries handle re-renders |
| Timer state (elapsed seconds) | Zustand store | Needs 1Hz updates, too frequent for Dexie; only persists on start/stop |
| Pomodoro state | Zustand store | Ephemeral countdown; no persistence needed |
| Task timer state | Zustand store | Ephemeral countdown; no persistence needed |
| Settings | Zustand store + Dexie write-through | Needs both immediate UI response (Zustand) and persistence (Dexie) |
| UI state (tabs, sidebar, selected nodes) | Zustand store | Ephemeral view state; no persistence needed |

### Worker Communication Pattern

```
                 Main Thread                          Worker Thread
                 -----------                          -------------
Component        Hook              Store              Worker File
    |               |                 |                    |
    |  user action  |                 |                    |
    |-------------->|                 |                    |
    |               |  store.start()  |                    |
    |               |---------------->|                    |
    |               |                 |  postMessage       |
    |               |  useEffect      |  { type: 'start' }|
    |               |------------------------------------>|
    |               |                 |                    |
    |               |                 |     setInterval    |
    |               |                 |     (1 second)     |
    |               |                 |        |           |
    |               |   onmessage     |        v           |
    |               |<------------------------------------|
    |               |                 |  postMessage       |
    |               |  store.tick()   |  { type: 'tick' }  |
    |               |---------------->|                    |
    |               |                 |                    |
    |  re-render    |                 |                    |
    |<--------------|  (via Zustand   |                    |
    |               |   selector)     |                    |
```

### ID Generation

All entity IDs use UUID v7 (`generateId()` from `utils/uuid.ts`), which is time-sortable. This means:
- IDs naturally sort in creation order
- No separate `createdAt` index needed for ordering by creation time
- IDs are globally unique across devices

### Device Attribution

Every record includes `deviceId` from `getDeviceId()` (localStorage-backed). This:
- Identifies which device created/modified a record
- Is used in sync for attribution
- Persists across sessions on the same device
- Is NOT used for conflict resolution (that uses `updatedAt` timestamps)

### Logical Date System

The app supports configurable day boundaries:
- `dayStartHour` (default: 6) defines when a "day" starts
- If current hour < dayStartHour, the logical date is "yesterday"
- Example: at 2am with dayStartHour=6, the logical date is the previous calendar day
- This means late-night activity counts toward the previous day
- `getLogicalDate(dayStartHour)` implements this in `utils/time.ts`
- Used when creating timeEntries and for analytics date calculations
