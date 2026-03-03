# Feature Interaction Map

**Project:** web_timer productivity app
**Researched:** 2026-03-03
**Method:** Full source code analysis of hooks, stores, pages, and components

---

## Table of Contents

1. [Timer <-> Activities <-> Time Entries](#timer--activities--time-entries)
2. [Pomodoro <-> Activities <-> Timer](#pomodoro--activities--timer)
3. [Task Timer <-> Today Tasks <-> Timer <-> Activities](#task-timer--today-tasks--timer--activities)
4. [Today Tasks <-> Projects/Tasks](#today-tasks--projectstasks)
5. [Inbox -> Projects/Tasks/Notes](#inbox---projectstasksnotes)
6. [Projects <-> Activities (Linked Activity)](#projects--activities-linked-activity)
7. [Projects <-> Folders](#projects--folders)
8. [Task Selection <-> Today Tasks <-> Projects/Tasks](#task-selection--today-tasks--projectstasks)
9. [Points Counter <-> Project Tasks](#points-counter--project-tasks)
10. [Procrastination Checker <-> Today Tasks <-> Settings](#procrastination-checker--today-tasks--settings)
11. [Analytics <-> Activities <-> Time Entries](#analytics--activities--time-entries)
12. [Recurring Tasks <-> Project Tasks](#recurring-tasks--project-tasks)
13. [Gamification (XP/Streaks) <-> Multiple Features](#gamification-xpstreaks--multiple-features)
14. [Settings Store <-> Every Feature](#settings-store--every-feature)
15. [Sync (REST) <-> Activities/TimeEntries/Settings](#sync-rest--activitiestimeentriessettings)
16. [Vault Sync <-> All Data](#vault-sync--all-data)
17. [Theme System <-> Settings <-> All UI](#theme-system--settings--all-ui)
18. [Navigation System <-> Settings](#navigation-system--settings)
19. [Day Boundary <-> Timer <-> Time Entries <-> Analytics](#day-boundary--timer--time-entries--analytics)
20. [Cascade Delete Chains](#cascade-delete-chains)
21. [Review Page (Standalone)](#review-page-standalone)
22. [Habits (Standalone)](#habits-standalone)
23. [Notes (Standalone)](#notes-standalone)
24. [Mind Maps (Standalone)](#mind-maps-standalone)
25. [PDF Documents (Standalone)](#pdf-documents-standalone)

---

## Timer <-> Activities <-> Time Entries

**Connection type:** Core data pipeline -- three-way data dependency
**Direction:** User clicks Activity -> Timer starts -> Time Entry created in DB

### How it works:

1. **ActivityList** (`components/activities/ActivityList.tsx:31`) renders activities from `useActivities()` and the timer from `useTimer()`.
2. When user clicks an activity card, `toggleTimer(activityId)` is called (`hooks/useTimer.ts:87-93`).
3. `toggleTimer` calls `timerStore.start(activityId, dayStartHour)` which:
   - Stops any currently running timer first (`stores/timerStore.ts:25-27`)
   - Creates a new `TimeEntry` in Dexie with `endedAt: null` (`stores/timerStore.ts:32-44`)
   - Sets store state: `isRunning: true`, `activeActivityId`, `activeEntryId` (`stores/timerStore.ts:46-52`)
4. The Web Worker (`workers/timer.worker.ts`) sends tick messages, and `useTimer` (`hooks/useTimer.ts:38-58`) updates `elapsed` in the store.
5. On stop, `timerStore.stop()` updates the TimeEntry with `endedAt` and `durationSeconds` (`stores/timerStore.ts:55-78`).
6. **ActivityList** displays per-activity elapsed time by calling `useTimeEntries().getElapsedForActivity(activityId)` (`hooks/useTimeEntries.ts:51-56`) which sums all completed entries for that activity on today's date.
7. **TimerDisplay** (`components/timer/TimerDisplay.tsx:9-10`) reads `useTimerStore` + `useActivities` to show the running activity name and live elapsed.
8. On app reload, `timerStore.restore()` (`stores/timerStore.ts:84-102`) finds any TimeEntry with `endedAt === null` and resumes.

### Files involved:
- `stores/timerStore.ts` -- Timer state + DB writes
- `hooks/useTimer.ts` -- Timer hook with Web Worker coordination
- `hooks/useActivities.ts` -- Activity CRUD
- `hooks/useTimeEntries.ts` -- Time entry queries + manual entry
- `components/timer/TimerDisplay.tsx` -- Running timer UI
- `components/activities/ActivityList.tsx` -- Activity cards + timer toggle
- `components/activities/ActivityCard.tsx` -- Individual activity card
- `workers/timer.worker.ts` -- Background tick counter

### Implicit connections:
- `useTimeEntries` reads `settingsStore.dayStartHour` for logical date calculation
- `timerStore.start()` takes `dayStartHour` parameter from settings
- Timer notifications read `timerNotificationsEnabled` and `timerNotificationIntervalMinutes` from settings
- `timerStore.stop()` awards XP via `awardXP(XP_VALUES.stopTimer)` when duration >= 60s (`stores/timerStore.ts:69`)

---

## Pomodoro <-> Activities <-> Timer

**Connection type:** Cross-feature store coordination -- Pomodoro controls the activity timer
**Direction:** Pomodoro work phase starts/stops the activity timer automatically

### How it works:

1. **PomodoroTimer** (`components/pomodoro/PomodoroTimer.tsx:72-263`) renders inside a Modal on HomePage.
2. User selects an activity to link via dropdown (`PomodoroTimer.tsx:231-243`), calling `setLinkedActivity(activityId)` on the `pomodoroStore`.
3. User selects a preset from `usePomodoroPresets()` and starts.
4. `usePomodoro` hook (`hooks/usePomodoro.ts:52-73`) contains the **critical integration effect**:
   - When `phase === 'work' && !isPaused` AND a `linkedActivityId` is set:
     - It calls `useTimerStore.getState().start(linkedActivityId, dayStartHour)` to start the activity timer
   - When transitioning FROM work TO break/longBreak:
     - It calls `useTimerStore.getState().stop()` to stop the activity timer
5. When Pomodoro is stopped entirely (`hooks/usePomodoro.ts:115-123`):
   - It checks if the linked activity timer is running and stops it

### Key detail -- three stores interact:
- `pomodoroStore` -- Pomodoro phase state
- `timerStore` -- Activity timer state (directly manipulated by Pomodoro hook)
- `settingsStore` -- Provides `dayStartHour` for time entry date

### Files involved:
- `stores/pomodoroStore.ts` -- Pomodoro state machine (phase transitions, tick logic)
- `hooks/usePomodoro.ts` -- Bridges pomodoroStore <-> timerStore <-> settingsStore
- `hooks/usePomodoroPresets.ts` -- Preset CRUD from Dexie
- `components/pomodoro/PomodoroTimer.tsx` -- UI with activity selector
- `workers/pomodoro.worker.ts` -- Background countdown ticker

### Implicit connections:
- Pomodoro auto-start settings (`autoStartBreaks`, `autoStartWork`) affect whether phase transitions pause
- The Pomodoro uses `useActivities()` to show non-break activities for linking

---

## Task Timer <-> Today Tasks <-> Timer <-> Activities

**Connection type:** Three-way store coordination -- Task Timer wraps activity timer for today tasks
**Direction:** Start task timer -> optionally starts linked activity timer

### How it works:

1. **TodayPage** (`pages/TodayPage.tsx:47`) initializes `useTaskTimer()`.
2. Each **TodayTaskCard** receives timer control callbacks (`TodayPage.tsx:97-101`):
   - `onStartTask={() => taskTimer.startTask(task.id, task.projectId, task.linkedActivityId)}`
3. `useTaskTimer.startTask()` (`hooks/useTaskTimer.ts:67-92`):
   - Stops any currently active task timer
   - Reads `taskTimerMinutes` from `settingsStore`
   - Starts countdown via `taskTimerStore.start()`
   - If `taskLinkedActivityId` is provided, starts the activity timer: `useTimerStore.getState().start(taskLinkedActivityId, dayStartHour)`
4. `useTaskTimer.stopTask()` (`hooks/useTaskTimer.ts:102-112`):
   - Stops the linked activity timer if running for this activity
   - Stops the task timer countdown
5. Task completion stops the task timer if active (`TodayPage.tsx:74-79`):
   ```typescript
   if (taskTimer.activeTaskId === taskId) {
     taskTimer.stopTask();
   }
   completeTask(taskId);
   ```

### Key detail -- `linkedActivityId` flow:
- Projects have a `linkedActivityId` field (`shared/types.ts`)
- `useTodayTasks` enriches today tasks with `linkedActivityId` from the project (`hooks/useTodayTasks.ts:39`)
- When task timer starts, it passes this linked activity ID to start time tracking

### Files involved:
- `stores/taskTimerStore.ts` -- Countdown state (separate from main timer)
- `hooks/useTaskTimer.ts` -- Bridges taskTimerStore <-> timerStore <-> settingsStore
- `hooks/useTodayTasks.ts` -- Enriches tasks with project's linkedActivityId
- `pages/TodayPage.tsx` -- Orchestrates task timer UI
- `components/today/TodayTaskCard.tsx` -- Per-task timer controls (play/pause/stop)
- `workers/pomodoro.worker.ts` -- Reused for task timer ticks (same countdown worker)

---

## Today Tasks <-> Projects/Tasks

**Connection type:** Bidirectional data dependency with completion sync
**Direction:** Tasks pulled from projects into today list; completion synced back

### How it works:

1. **Adding to Today**: `useTodayTasks.addToToday(projectTaskId, projectId)` (`hooks/useTodayTasks.ts:48-77`) creates a `TodayTask` record referencing the `ProjectTask` and `Project`.
2. **Enrichment**: `useTodayTasks` enriched query (`hooks/useTodayTasks.ts:21-46`) joins:
   - `todayTasks` table (by date)
   - `projectTasks` table (for title via `tt.projectTaskId`)
   - `projects` table (for name, color via `tt.projectId`)
   - Also reads `project.linkedActivityId` for the task timer link
3. **Completion sync back to ProjectTask** (`hooks/useTodayTasks.ts:84-101`):
   ```typescript
   // Sync to underlying ProjectTask
   await db.projectTasks.update(tt.projectTaskId, {
     isCompleted: newCompleted,
     completedAt: newCompleted ? now : null,
   });
   ```
   Toggling completion on a today task updates BOTH the `todayTasks` and `projectTasks` records.
4. **Title editing syncs back** (`hooks/useTodayTasks.ts:124-132`):
   ```typescript
   await db.projectTasks.update(tt.projectTaskId, { title: newTitle });
   ```

### Files involved:
- `hooks/useTodayTasks.ts` -- TodayTask CRUD with enrichment + bidirectional sync
- `hooks/useProjectTasks.ts` -- ProjectTask CRUD
- `hooks/useProjects.ts` -- Project data
- `pages/TodayPage.tsx` -- Today view
- `components/today/TodayTaskCard.tsx` -- Task card UI

---

## Inbox -> Projects/Tasks/Notes

**Connection type:** Data transformation pipeline (one-way)
**Direction:** Inbox items get sorted into projects (as tasks), new projects, or notes

### How it works:

InboxView has a "sort mode" (`components/inbox/InboxView.tsx:354-540`) that presents each inbox item with four options:

1. **"Task"** (`InboxView.tsx:204-232`): Opens project picker, then creates a `ProjectTask`:
   ```typescript
   await db.projectTasks.add({ ... title: currentItem.text, projectId ... });
   await deleteItem(currentItem.id);
   ```
2. **"New Project"** (`InboxView.tsx:234-254`): Creates a new `Project` using the inbox text:
   - If text contains "-", splits into project name (before dash) and description (after dash)
   - Otherwise uses first 3 words as project name
   ```typescript
   await createProject({ name: projectName, color, description: draft });
   await deleteItem(currentItem.id);
   ```
3. **"Idea"** (`InboxView.tsx:256-273`): Creates a `Note`:
   ```typescript
   await db.notes.add({ ... title: currentItem.text, content: '' ... });
   await deleteItem(currentItem.id);
   ```
4. **"Task Mode"** in capture view (`InboxView.tsx:128-153`): Quick-assign inbox items to projects as tasks from the list view.

### Additional connection:
- **ProjectsView** shows inbox count (`components/projects/ProjectsView.tsx:29-32`):
  ```typescript
  const inboxCount = useLiveQuery(() => db.inboxItems.filter(i => !i.deletedAt).count());
  ```
  And has a "Sort Inbox" button (`ProjectsView.tsx:244-256`) that navigates to `/inbox?mode=sort`.

### Files involved:
- `hooks/useInbox.ts` -- Inbox CRUD
- `components/inbox/InboxView.tsx` -- Sort mode logic, project/task/note creation
- `hooks/useProjects.ts` -- Used for project list + creation
- `components/projects/ProjectsView.tsx` -- Inbox count badge + sort link
- Directly writes to `db.projectTasks` and `db.notes` (bypasses hooks)

---

## Projects <-> Activities (Linked Activity)

**Connection type:** Foreign key relationship
**Direction:** Projects can reference an Activity for time tracking

### How it works:

1. **Project has `linkedActivityId` field** (`shared/types.ts` Project interface, `hooks/useProjects.ts:28`)
2. **ProjectDraftEditor** (`components/projects/ProjectDraftEditor.tsx:17`) receives `linkedActivityId` and `activities` props:
   - Shows an activity selector dropdown
   - Calls `onLinkActivity(activityId)` which updates the project
3. **ProjectsView** passes activities to the editor (`components/projects/ProjectsView.tsx:28,310-311`):
   ```typescript
   const { activities } = useActivities();
   // ...
   linkedActivityId={(activeProject as any).linkedActivityId ?? null}
   onLinkActivity={(activityId) => updateProject(activeProject.id, { linkedActivityId: activityId })}
   activities={activities}
   ```
4. **This linked activity flows downstream** to:
   - `useTodayTasks` enrichment (`hooks/useTodayTasks.ts:39`): `linkedActivityId: (project as any).linkedActivityId ?? null`
   - Task timer start (`hooks/useTaskTimer.ts:89-91`): If linked activity exists, starts the main timer for that activity
   - This creates the chain: **Project -> linked Activity -> Today Task -> Task Timer -> Activity Timer -> Time Entry**

### Files involved:
- `hooks/useProjects.ts` -- `linkedActivityId` in create/update
- `components/projects/ProjectDraftEditor.tsx` -- Activity picker UI
- `components/projects/ProjectsView.tsx` -- Passes activities to editor
- `hooks/useTodayTasks.ts` -- Enriches with linkedActivityId
- `hooks/useTaskTimer.ts` -- Uses linkedActivityId to start activity timer

---

## Projects <-> Folders

**Connection type:** Hierarchical containment
**Direction:** Folders contain projects; deleting folder moves projects to root

### How it works:

1. Projects have `folderId` field (nullable) linking to `projectFolders` table.
2. **useFolders.deleteFolder()** (`hooks/useFolders.ts:46-54`):
   ```typescript
   // Move child projects to root
   const childProjects = await db.projects.where('folderId').equals(id).toArray();
   for (const p of childProjects) {
     await db.projects.update(p.id, { folderId: null });
   }
   ```
   NOTE: This does NOT cascade delete -- it orphans projects to root level.
3. **useAllProjectTasks** (`hooks/useAllProjectTasks.ts:48-92`) groups projects by folder for the Task Selection view.
4. **FileTree** in ProjectsView displays the folder/project hierarchy.

### Files involved:
- `hooks/useFolders.ts` -- Folder CRUD + project re-parenting
- `hooks/useProjects.ts` -- `folderId` field, `moveProject()`
- `hooks/useAllProjectTasks.ts` -- Groups by folder for display
- `components/projects/FileTree.tsx` -- Folder/project tree UI

---

## Task Selection <-> Today Tasks <-> Projects/Tasks

**Connection type:** UI composition bridging three data sources
**Direction:** Shows all project tasks, toggles them into/out of today list

### How it works:

1. **TaskSelectionView** (`components/taskSelection/TaskSelectionView.tsx:40-43`) uses three hooks:
   ```typescript
   const { groups, folderGroups } = useAllProjectTasks();
   const { todayTasks, toggleToday } = useTodayTasks();
   const { projects, reorderProjects } = useProjects();
   ```
2. Builds `todayTaskIds` set to track which tasks are selected (`TaskSelectionView.tsx:70-73`).
3. `toggleToday(taskId, projectId)` from `useTodayTasks` adds/removes from today list.
4. **Procrastination checker** integration (`TaskSelectionView.tsx:64,109-114`):
   - Reads `procrastinationWords` from settings
   - Sorts tasks with `isProcrastinationRisky()` in "suspicious" sort mode
5. **Quick add task** (`TaskSelectionView.tsx:250-275`): Creates tasks directly in `db.projectTasks` (bypasses hook), picking target project from dropdown.
6. **PointsCounter** component displayed in header (`TaskSelectionView.tsx:320`).

### Files involved:
- `components/taskSelection/TaskSelectionView.tsx` -- Main orchestrator
- `hooks/useAllProjectTasks.ts` -- All projects + tasks grouped
- `hooks/useTodayTasks.ts` -- Today task toggle
- `hooks/useProjects.ts` -- Project list for reordering
- `hooks/useProjectTasks.ts` -- Used for quick add
- `components/taskSelection/PointsCounter.tsx` -- Points display
- `utils/procrastinationCheck.ts` -- Risk detection

---

## Points Counter <-> Project Tasks

**Connection type:** Derived computation from task data
**Direction:** Reads all incomplete tasks, computes staleness score

### How it works:

1. `usePointsCounter` (`hooks/usePointsCounter.ts:11-13`) queries ALL incomplete project tasks:
   ```typescript
   const incompleteTasks = useLiveQuery(
     () => db.projectTasks.filter(t => !t.deletedAt && !t.isCompleted).toArray()
   );
   ```
2. Computes quadratic staleness score (`hooks/usePointsCounter.ts:20-25`):
   ```typescript
   const ageDays = ageMs / 86400000;
   score += ageDays * ageDays;
   ```
3. Recalculates every 60 seconds via `setInterval`.
4. Visibility controlled by `settingsStore.pointsCounterVisible`.

### Files involved:
- `hooks/usePointsCounter.ts` -- Score computation
- `stores/settingsStore.ts` -- `pointsCounterVisible` setting
- `components/taskSelection/PointsCounter.tsx` -- Display component

---

## Procrastination Checker <-> Today Tasks <-> Settings

**Connection type:** Rule-based filter using settings data
**Direction:** Settings defines words -> TodayTaskCard checks titles -> Shows warning + modal

### How it works:

1. **Settings** stores `procrastinationWords[]` and `dismissedProcrastinationTaskIds[]`.
2. **TodayTaskCard** (`components/today/TodayTaskCard.tsx:68-76`) reads both from settings:
   ```typescript
   const procrastinationWords = useSettingsStore((s) => s.procrastinationWords);
   const dismissedIds = useSettingsStore((s) => s.dismissedProcrastinationTaskIds);
   const isRisky = !task.isCompleted
     && isProcrastinationRisky(task.taskTitle, procrastinationWords)
     && !dismissedIds.includes(dismissKey);
   ```
3. If risky, shows a warning icon + **ProcrastinationConfirmModal** with 5-second countdown.
4. Dismissing writes back to settings: `updateSettings({ dismissedProcrastinationTaskIds: [...dismissedIds, dismissKey] })`.
5. **TaskSelectionView** also uses it for "suspicious" sort mode (`components/taskSelection/TaskSelectionView.tsx:109-114`).

### Files involved:
- `utils/procrastinationCheck.ts` -- `isProcrastinationRisky()`, `getMatchedWords()`
- `components/today/TodayTaskCard.tsx` -- Warning icon + modal trigger
- `components/ui/ProcrastinationConfirmModal.tsx` -- 5-second countdown modal
- `components/taskSelection/TaskSelectionView.tsx` -- Sort by suspicious
- `stores/settingsStore.ts` -- `procrastinationWords`, `dismissedProcrastinationTaskIds`

---

## Analytics <-> Activities <-> Time Entries

**Connection type:** Read-only aggregation pipeline
**Direction:** Analytics reads activities + time entries, computes summaries

### How it works:

1. `useAnalytics` (`hooks/useAnalytics.ts:27-186`) queries both `activities` and `timeEntries` tables.
2. **getDailySummary(date)** (`hooks/useAnalytics.ts:33-49`): Joins activities with time entries for a specific date, computing total seconds per activity.
3. **getWeeklySummary** / **getMonthlySummary**: Calls getDailySummary for each day in range.
4. **getStreaks** (`hooks/useAnalytics.ts:94-147`): Groups ALL time entries by date, then per activity checks consecutive days.
5. **getAverages** (`hooks/useAnalytics.ts:149-176`): Averages time entries over N days per activity.
6. Chart rendering uses `useThemeColors()` for styling -- connects to theme system.

### Files involved:
- `hooks/useAnalytics.ts` -- All aggregation logic
- `hooks/useThemeColors.ts` -- Chart color values
- `components/analytics/DailyView.tsx` -- Daily chart/table
- `components/analytics/WeeklyView.tsx` -- Weekly chart
- `components/analytics/MonthlyView.tsx` -- Monthly chart
- `components/analytics/StreaksView.tsx` -- Streak display
- `pages/AnalyticsPage.tsx` -- Tab container

---

## Recurring Tasks <-> Project Tasks

**Connection type:** Self-referencing data transformation
**Direction:** Completing a recurring task auto-creates next occurrence

### How it works:

Two separate mechanisms:

1. **On completion** (`hooks/useProjectTasks.ts:66-88`):
   ```typescript
   if (newCompleted && task.recurrenceRule) {
     // Auto-create next occurrence
     await db.projectTasks.add({
       ...task fields...,
       isCompleted: false,
       recurrenceRule: task.recurrenceRule,
       lastRecurredDate: today,
     });
   }
   ```

2. **On app load** (`hooks/useRecurringTaskCheck.ts:7-52`): Called in `App.tsx:45`:
   ```typescript
   useRecurringTaskCheck();
   ```
   This effect runs once on mount, scans all completed tasks with recurrence rules, and creates new incomplete copies if `shouldCreateRecurrence()` returns true and no pending copy exists.

### Files involved:
- `hooks/useProjectTasks.ts` -- toggleTask creates next occurrence
- `hooks/useRecurringTaskCheck.ts` -- App-load recurrence check
- `utils/recurrence.ts` -- `shouldCreateRecurrence()`, `getNextOccurrenceDate()`
- `App.tsx` -- Calls `useRecurringTaskCheck()` at root level

---

## Gamification (XP/Streaks) <-> Multiple Features

**Connection type:** Cross-cutting concern -- `awardXP()` called from many hooks
**Direction:** Actions across features award XP, which updates settings store

### How it works:

1. `awardXP(amount)` (`utils/streak.ts:21-60`) is a pure function that:
   - Reads `settingsStore.getState()` for current streak/XP state
   - Checks if gamification is enabled
   - Updates streak logic (consecutive days)
   - Writes back to settings via `state.update({ currentStreak, totalXP, todayXP, ... })`

2. **XP values** (`utils/streak.ts:4-13`):
   | Action | XP | Where Called |
   |--------|-----|-------------|
   | completeTask | 15 | `useTodayTasks.ts:94`, `useProjectTasks.ts:65` |
   | checkHabit | 10 | `useHabits.ts:124,137,161` |
   | stopTimer | 10 | `timerStore.ts:69` (only if >= 60s) |
   | createNote | 10 | `useNotes.ts:40` |
   | createTask | 5 | `useProjectTasks.ts:44` |
   | addInboxItem | 5 | `useInbox.ts:28` |
   | createMindMap | 5 | `useMindMaps.ts:34` |
   | createProject | 5 | `useProjects.ts:35` |

3. **Display components**:
   - `StreakXPBanner` (`components/gamification/StreakXPBanner.tsx`) -- Shown on HomePage
   - `SidebarStreakIndicator` (`components/gamification/SidebarStreakIndicator.tsx`) -- Shown in Sidebar

4. XP is date-scoped: `todayXP` resets when the logical date changes, using `getLogicalDate(dayStartHour)` from settings.

### Files involved:
- `utils/streak.ts` -- `awardXP()`, `getLevel()`, `getLevelProgress()`
- `stores/settingsStore.ts` -- Persists `currentStreak`, `longestStreak`, `totalXP`, `todayXP`, etc.
- `stores/timerStore.ts` -- Awards XP on timer stop
- `hooks/useProjectTasks.ts` -- Awards XP on task create/complete
- `hooks/useTodayTasks.ts` -- Awards XP on task complete
- `hooks/useHabits.ts` -- Awards XP on habit check
- `hooks/useNotes.ts` -- Awards XP on note create
- `hooks/useInbox.ts` -- Awards XP on inbox add
- `hooks/useMindMaps.ts` -- Awards XP on mind map create
- `hooks/useProjects.ts` -- Awards XP on project create
- `components/gamification/StreakXPBanner.tsx` -- HomePage display
- `components/gamification/SidebarStreakIndicator.tsx` -- Sidebar display

---

## Settings Store <-> Every Feature

**Connection type:** Global configuration dependency
**Direction:** Settings store provides configuration consumed by all features

### Settings consumed by feature:

| Setting | Consumed By | File |
|---------|-------------|------|
| `dayStartHour` | Timer start, time entry queries, analytics, XP date logic | `timerStore.ts`, `useTimeEntries.ts`, `usePomodoro.ts`, `useTaskTimer.ts`, `streak.ts` |
| `dayEndHour` | Day boundary calculation | `useDayBoundary.ts` |
| `theme` | All UI components via CSS classes | `settingsStore.ts:applyTheme()` |
| `accentColor` | All UI via CSS var override | `settingsStore.ts:applyAccentColor()` |
| `customThemeColors` | Custom theme + chart colors | `settingsStore.ts`, `useThemeColors.ts` |
| `uiZoom` | Document font size | `settingsStore.ts:applyZoom()` |
| `language` | All translated strings | `i18n/useTranslation.ts` |
| `navPosition` | AppShell layout (sidebar/bottom/dropdown) | `AppShell.tsx`, `Sidebar.tsx` |
| `hiddenNavTabs` | Navigation visibility | All nav components |
| `navTabOrder` | Navigation ordering | All nav components |
| `barStyle` | Progress bar variant | Progress components |
| `timerNotificationsEnabled` | Timer notification logic | `useTimer.ts:29-30` |
| `timerNotificationIntervalMinutes` | Timer notification frequency | `useTimer.ts:30` |
| `pointsCounterVisible` | Points display toggle | `usePointsCounter.ts:8` |
| `procrastinationWords` | Procrastination detection | `TodayTaskCard.tsx`, `TaskSelectionView.tsx` |
| `dismissedProcrastinationTaskIds` | Per-task dismiss tracking | `TodayTaskCard.tsx` |
| `maxTasksPerProject` | Task limit enforcement | `ProjectTaskList.tsx` |
| `syncEnabled` / `syncServerUrl` / `syncApiKey` | REST sync | `syncEngine.ts` |
| `vaultEnabled` / `vaultPath` / `vaultSetupDone` | Vault file sync | `App.tsx`, `vaultStore.ts` |
| `taskTimerMinutes` | Task timer countdown duration | `useTaskTimer.ts:33` |
| `gamificationEnabled` | XP/streak system toggle | `streak.ts:23`, `StreakXPBanner.tsx`, `SidebarStreakIndicator.tsx` |
| `currentStreak` / `totalXP` / `todayXP` | Gamification display | `StreakXPBanner.tsx`, `SidebarStreakIndicator.tsx` |

### Persistence mechanism:
- `settingsStore.update(patch)` writes to Dexie `settings` table (id='default') on every call (`settingsStore.ts:182-216`)
- `settingsStore.load()` reads from Dexie on app start, with migration logic for legacy fields (`settingsStore.ts:120-179`)

### Files involved:
- `stores/settingsStore.ts` -- Central settings store
- `shared/constants.ts` -- `DEFAULT_SETTINGS`
- Every hook and component that imports `useSettingsStore`

---

## Sync (REST) <-> Activities/TimeEntries/Settings

**Connection type:** Selective data replication
**Direction:** Bidirectional pull-before-push with LWW conflict resolution

### What syncs:
| Entity | Syncs | Note |
|--------|-------|------|
| Activities | YES | Full LWW sync |
| Time Entries | YES | Full LWW sync |
| Settings | YES | Single record LWW |
| Habits | NO | Local only |
| Habit Entries | NO | Local only |
| Notes | NO | Local only |
| Projects | NO | Local only |
| Project Tasks | NO | Local only |
| Today Tasks | NO | Local only |
| Project Folders | NO | Local only |
| Inbox Items | NO | Local only |
| Mind Maps | NO | Local only |
| Pomodoro Presets | NO | Local only |
| PDF Documents | NO | Local only |

### How it works:
1. `syncNow()` (`sync/syncEngine.ts:7-83`) reads sync config from `settingsStore`.
2. **Pull**: GET `/api/sync/changes?since=lastSyncedAt` -> applies server changes locally using LWW.
3. **Push**: POST `/api/sync/changes` with local changes since `lastSyncedAt`.
4. Server uses SQLite with `INSERT ON CONFLICT DO UPDATE` per-field LWW.

### Files involved:
- `sync/syncEngine.ts` -- Client sync logic
- `stores/settingsStore.ts` -- Sync configuration
- `server/src/services/syncService.ts` -- Server merge logic
- `server/src/routes/sync.ts` -- API endpoints

---

## Vault Sync <-> All Data

**Connection type:** Comprehensive file-based data replication
**Direction:** Bidirectional -- Dexie <-> Markdown/JSON files on disk

### What syncs (EVERYTHING):
Unlike REST sync, vault sync covers ALL entities: activities, notes, projects+tasks, habits+entries, mind maps, inbox items, time entries, today tasks, settings, pomodoro presets, folders, PDF documents.

### How it works:
1. **Vault store** (`vault/vaultStore.ts`) manages vault state.
2. **Export** (`vault/vaultSync.ts:26-162`): `exportAllToDisk()` serializes each entity type to markdown/JSON files.
3. **Import** (`vault/vaultSync.ts:166-337`): `importAllFromDisk()` reads files and merges via LWW.
4. **Live sync** (`vault/vaultSync.ts:359-541`): `writeEntityToDisk()` handles individual entity changes.
5. **External changes** (`vault/vaultSync.ts:561-698`): `handleExternalChange()` handles file watcher events (Tauri).
6. **Dexie hooks** (`vault/dexieHooks.ts`) listen for DB changes and trigger writes.
7. Activated in `App.tsx:33-43` when `vaultEnabled && vaultPath` are set.

### Files involved:
- `vault/vaultSync.ts` -- Core sync logic
- `vault/vaultStore.ts` -- Vault state management
- `vault/serializers.ts` -- Entity serialization/deserialization
- `vault/dexieHooks.ts` -- DB change listeners
- `vault/tauriBackend.ts` -- Tauri file system backend
- `vault/memoryBackend.ts` -- In-memory backend (testing)
- `vault/webExport.ts` -- Web download fallback
- `App.tsx` -- Vault initialization

---

## Theme System <-> Settings <-> All UI

**Connection type:** CSS variable cascade controlled by settings
**Direction:** Settings -> CSS classes/properties -> All components

### How it works:
1. `settingsStore.applyTheme()` (`settingsStore.ts:49-61`): Sets CSS class on `<html>` element.
2. `index.css` defines `--color-*` and `--shadow-*` variables per theme class.
3. `shadows.ts` exports `NEU` object with semantic shadow names referencing CSS vars.
4. Components use both Tailwind classes (`bg-bg-card`, `text-text-primary`) and inline styles (`style={{ boxShadow: NEU.raised }}`).
5. `useThemeColors()` (`hooks/useThemeColors.ts:128-155`) returns hardcoded color values per theme for Recharts (charts cannot use CSS vars).
6. Custom theme applies via `element.style.setProperty()` inline CSS overrides.
7. `accentColor` is separately applied and persists across theme switches.

### Files involved:
- `stores/settingsStore.ts` -- Theme application logic
- `hooks/useThemeColors.ts` -- Chart colors per theme, `useIsDark()`, `useThemeMode()`
- `index.css` -- CSS variable definitions per theme
- `utils/shadows.ts` -- Shadow token references
- Every component using `NEU.*` or Tailwind color classes

---

## Navigation System <-> Settings

**Connection type:** Configuration-driven layout
**Direction:** Settings determine which nav component renders and which tabs are visible

### How it works:
1. `navPosition` setting ('left' | 'bottom' | 'dropdown') controls which nav renders in AppShell.
2. `hiddenNavTabs[]` hides specific route tabs.
3. `navTabOrder[]` reorders tabs.
4. All four nav components (Sidebar, BottomNav, DesktopBottomNav, DropdownNav) read these settings.
5. Context menu on nav items allows hide/reorder.

### Files involved:
- `components/layout/AppShell.tsx` -- Conditional nav rendering
- `components/layout/Sidebar.tsx` -- Left sidebar nav
- `components/layout/BottomNav.tsx` -- Mobile bottom nav
- `components/layout/DesktopBottomNav.tsx` -- Desktop bottom nav
- `components/layout/DropdownNav.tsx` -- FAB + dropdown nav
- `stores/settingsStore.ts` -- `navPosition`, `hiddenNavTabs`, `navTabOrder`

---

## Day Boundary <-> Timer <-> Time Entries <-> Analytics

**Connection type:** Shared logical date concept
**Direction:** Settings define day boundary -> Timer and entries use it -> Analytics aggregates by it

### How it works:
1. `dayStartHour` defines when a new "logical day" starts (e.g., 6 means 6 AM).
2. `getLogicalDate(dayStartHour)` (`utils/time.ts`) returns the current logical date string.
3. `timerStore.start()` uses this for the `date` field of new TimeEntries.
4. `useTimeEntries` uses it to query entries for "today".
5. Analytics aggregates by this date field.
6. `useDayBoundary` (`hooks/useDayBoundary.ts`) polls every 60s and fires `onDayChange` callback at boundary.
7. XP system uses `getLogicalDate(dayStartHour)` for streak tracking.

### Files involved:
- `utils/time.ts` -- `getLogicalDate()`, `getTodayRange()`
- `stores/timerStore.ts` -- Uses logical date for new entries
- `hooks/useTimeEntries.ts` -- Queries by logical date
- `hooks/useDayBoundary.ts` -- Day change detection
- `hooks/useAnalytics.ts` -- Aggregates by date field
- `utils/streak.ts` -- Uses logical date for streak tracking

---

## Cascade Delete Chains

### Chain 1: Project -> Tasks -> TodayTasks

**Trigger:** `useProjects.deleteProject(id)` (`hooks/useProjects.ts:56-73`)

```
1. Soft-delete project: db.projects.update(id, { deletedAt })
2. Cascade to tasks: db.projectTasks.where('projectId').equals(id)
   -> For each non-deleted task: db.projectTasks.update(task.id, { deletedAt })
3. Cascade to today tasks: db.todayTasks.where('projectId').equals(id)
   -> For each non-deleted today task: db.todayTasks.update(tt.id, { deletedAt })
```

**Note:** This cascade does NOT go through useProjectTasks.deleteTask(), it directly updates the DB. The today task cascade uses `projectId` index, not `projectTaskId`.

### Chain 2: Task -> TodayTasks

**Trigger:** `useProjectTasks.deleteTask(id)` (`hooks/useProjectTasks.ts:98-109`)

```
1. Soft-delete task: db.projectTasks.update(id, { deletedAt })
2. Cascade to today tasks: db.todayTasks.where('projectTaskId').equals(id)
   -> For each non-deleted today task: db.todayTasks.update(tt.id, { deletedAt })
```

### Chain 3: Folder -> Projects (re-parent, NOT delete)

**Trigger:** `useFolders.deleteFolder(id)` (`hooks/useFolders.ts:46-54`)

```
1. Soft-delete folder: db.projectFolders.update(id, { deletedAt })
2. Move child projects to root: db.projects.where('folderId').equals(id)
   -> For each: db.projects.update(p.id, { folderId: null })
```

**Note:** Projects are NOT deleted, only re-parented.

### Chain 4: Flat view task delete (TaskSelectionView)

**Trigger:** `TaskSelectionView` inline delete handler (`components/taskSelection/TaskSelectionView.tsx:531-542`)

```
1. Soft-delete task: db.projectTasks.update(task.id, { deletedAt })
2. Cascade to today tasks: db.todayTasks.where('projectTaskId').equals(task.id)
   -> For each: db.todayTasks.update(tt.id, { deletedAt })
```

**Note:** This duplicates the cascade logic from useProjectTasks.deleteTask() -- it's a separate inline implementation.

### Chain 5: Inbox sort -> delete item + create entity

**Trigger:** InboxView sort mode actions (`components/inbox/InboxView.tsx`)

```
1. Read inbox item text
2. Create new entity (ProjectTask, Project, or Note)
3. Soft-delete inbox item: deleteItem(currentItem.id)
```

This is a transform chain, not a cascade delete.

### Chain 6: Today task complete -> ProjectTask update

**Trigger:** `useTodayTasks.completeTask(id)` (`hooks/useTodayTasks.ts:84-101`)

```
1. Toggle todayTask.isCompleted + completedAt
2. Sync to projectTask: db.projectTasks.update(tt.projectTaskId, { isCompleted, completedAt })
```

### Chain 7: Task complete with recurrence -> create new task

**Trigger:** `useProjectTasks.toggleTask(id)` (`hooks/useProjectTasks.ts:55-88`)

```
1. Toggle projectTask.isCompleted
2. If newly completed AND has recurrenceRule:
   -> Create new ProjectTask with same title, recurrenceRule, isCompleted: false
```

---

## Shared State Dependencies

### Dexie Tables accessed by multiple features:

| Table | Read By | Written By |
|-------|---------|------------|
| `activities` | ActivityList, Timer, Pomodoro, Analytics, ProjectDraftEditor, Sync, Vault | useActivities, Sync, Vault |
| `timeEntries` | ActivityList (elapsed), Timer, Analytics, Sync, Vault | timerStore (start/stop), useTimeEntries (manual), Sync, Vault |
| `settings` | Every feature via settingsStore | settingsStore.update(), Sync, Vault |
| `projectTasks` | ProjectTaskList, TaskSelection, TodayTasks (enrichment), PointsCounter, Inbox (sort), RecurringTaskCheck, Vault | useProjectTasks, useTodayTasks (completion sync), Inbox (sort), TaskSelectionView (inline), Vault |
| `projects` | ProjectsView, TaskSelection, TodayTasks (enrichment), Inbox (sort/create), Vault | useProjects, Inbox (new project), Vault |
| `todayTasks` | TodayPage, TaskSelection (toggle), Vault | useTodayTasks, useProjects.deleteProject (cascade), useProjectTasks.deleteTask (cascade), TaskSelectionView (inline cascade), Vault |
| `projectFolders` | FileTree, TaskSelection, Vault | useFolders, Vault |
| `notes` | NotesPage, Vault | useNotes, Inbox (idea sort), Vault |
| `inboxItems` | InboxView, ProjectsView (count), Vault | useInbox, Vault |
| `habits` / `habitEntries` | HabitsPage, Vault | useHabits, Vault |
| `mindMaps` | MindMapPage, Vault | useMindMaps, Vault |
| `pomodoroPresets` | PomodoroTimer, Vault | usePomodoroPresets, Vault |
| `pdfDocuments` | (PDF viewer), Vault | usePdfDocuments, Vault |

### Zustand Stores accessed by multiple features:

| Store | Read By | Written By |
|-------|---------|------------|
| `timerStore` | TimerDisplay, ActivityList, usePomodoro, useTaskTimer | useTimer (start/stop/tick), usePomodoro (start/stop linked), useTaskTimer (start/stop linked) |
| `pomodoroStore` | HomePage (isActive indicator), PomodoroTimer | usePomodoro (all actions) |
| `settingsStore` | Every feature (see table above) | Settings UI, awardXP(), settingsStore.load() |
| `projectUIStore` | ProjectsView | ProjectsView (tab/sidebar actions) |
| `mindMapUIStore` | MindMapPage | MindMapPage (selection/mode) |
| `taskTimerStore` | TodayPage, TodayTaskCard | useTaskTimer (start/stop/pause/resume) |
| `sidebarStore` | AppShell, Sidebar | Sidebar toggle |

---

## Review Page (Standalone)

**Connection type:** No data dependencies on other features
**Direction:** Self-contained checklist UI

The ReviewPage (`components/review/ReviewView.tsx`) is entirely self-contained. It uses:
- Local React state only (no Dexie, no Zustand stores)
- Default checklist items from translation keys
- No cross-feature connections

**Files:** `pages/ReviewPage.tsx`, `components/review/ReviewView.tsx`

---

## Habits (Standalone)

**Connection type:** Minimal cross-feature connections
**Direction:** Mostly self-contained, connects only to Settings (day boundary) and Gamification

Habits are largely isolated:
- Own tables: `habits`, `habitEntries`
- Own hook: `useHabits()`
- Own page: `HabitsPage`
- **Only cross-feature connections:**
  - Awards XP via `awardXP(XP_VALUES.checkHabit)` on habit completion
  - Vault sync exports/imports habits
  - Uses `generateId()`, `getDeviceId()` (shared utilities)

**Files:** `hooks/useHabits.ts`, `pages/HabitsPage.tsx`, `components/habits/*`

---

## Notes (Standalone)

**Connection type:** Minimal cross-feature connections
**Direction:** Mostly self-contained, created from Inbox sort

Notes are largely isolated:
- Own table: `notes`
- Own hook: `useNotes()`
- Own page: `NotesPage`
- **Cross-feature connections:**
  - Inbox sort mode creates notes directly via `db.notes.add()` (`InboxView.tsx:257-272`)
  - Awards XP via `awardXP(XP_VALUES.createNote)` on note creation
  - Vault sync exports/imports notes

**Files:** `hooks/useNotes.ts`, `pages/NotesPage.tsx`, `components/notes/*`

---

## Mind Maps (Standalone)

**Connection type:** Minimal cross-feature connections
**Direction:** Self-contained with own UI store

Mind Maps are largely isolated:
- Own table: `mindMaps`
- Own hook: `useMindMaps()`
- Own UI store: `mindMapUIStore`
- Own page: `MindMapPage`
- **Cross-feature connections:**
  - Awards XP via `awardXP(XP_VALUES.createMindMap)` on creation
  - Vault sync exports/imports mind maps
  - Uses `ACTIVITY_COLORS` for random color assignment

**Files:** `hooks/useMindMaps.ts`, `stores/mindMapUIStore.ts`, `pages/MindMapPage.tsx`, `components/mindmap/*`

---

## PDF Documents (Standalone)

**Connection type:** Minimal cross-feature connections
**Direction:** Self-contained blob storage

PDF Documents are isolated:
- Own table: `pdfDocuments`
- Own hook: `usePdfDocuments()`
- **Cross-feature connections:**
  - Vault sync exports/imports PDFs (including binary data)

**Files:** `hooks/usePdfDocuments.ts`, Vault serialization

---

## Interaction Matrix

| Feature | Connects To | Type | Direction | Key Files |
|---------|-------------|------|-----------|-----------|
| Timer | Activities | Data dependency | Timer reads activity list | `timerStore.ts`, `useActivities.ts` |
| Timer | Time Entries | DB write | Timer creates/updates entries | `timerStore.ts` |
| Timer | Settings | Config read | dayStartHour, notifications | `useTimer.ts` |
| Timer | Gamification | XP award | Stop timer awards XP | `timerStore.ts:69` |
| Pomodoro | Timer | Store control | Starts/stops timer for linked activity | `usePomodoro.ts:52-73` |
| Pomodoro | Activities | UI composition | Activity selector for linking | `PomodoroTimer.tsx:94,231-243` |
| Pomodoro | Settings | Config read | dayStartHour | `usePomodoro.ts:60` |
| Pomodoro | Presets | Data source | Reads presets from DB | `usePomodoroPresets.ts` |
| Task Timer | Timer | Store control | Starts/stops timer for linked activity | `useTaskTimer.ts:89-91,106-109` |
| Task Timer | Today Tasks | Data dependency | Gets linkedActivityId from enriched tasks | `useTodayTasks.ts:39` |
| Task Timer | Settings | Config read | taskTimerMinutes, dayStartHour | `useTaskTimer.ts:33-34` |
| Today Tasks | Project Tasks | Bidirectional sync | Completion syncs both ways | `useTodayTasks.ts:84-101` |
| Today Tasks | Projects | Data enrichment | Reads project name, color, linkedActivityId | `useTodayTasks.ts:32-40` |
| Today Tasks | Procrastination | Rule check | Checks task titles against word list | `TodayTaskCard.tsx:68-76` |
| Today Tasks | Task Timer | UI integration | Provides timer controls per task | `TodayPage.tsx:82-103` |
| Today Tasks | Gamification | XP award | Complete task awards XP | `useTodayTasks.ts:94` |
| Task Selection | All Tasks | Data source | Reads all projects/tasks grouped | `useAllProjectTasks.ts` |
| Task Selection | Today Tasks | Toggle | Adds/removes tasks from today | `useTodayTasks.toggleToday()` |
| Task Selection | Points | UI composition | Shows PointsCounter | `TaskSelectionView.tsx:320` |
| Task Selection | Procrastination | Sort mode | Sorts by suspicious tasks | `TaskSelectionView.tsx:109-114` |
| Projects | Activities | FK reference | linkedActivityId | `useProjects.ts:28` |
| Projects | Tasks | Parent-child | Project owns tasks | `useProjectTasks.ts` |
| Projects | Folders | Parent-child | Folder contains projects | `useFolders.ts` |
| Projects | Inbox | Badge count | Shows inbox count in header | `ProjectsView.tsx:29-32,244-256` |
| Projects | Gamification | XP award | Create project awards XP | `useProjects.ts:35` |
| Inbox | Projects | Data creation | Sort creates projects | `InboxView.tsx:234-254` |
| Inbox | Project Tasks | Data creation | Sort creates tasks | `InboxView.tsx:204-232` |
| Inbox | Notes | Data creation | Sort creates notes | `InboxView.tsx:256-273` |
| Inbox | Gamification | XP award | Add item awards XP | `useInbox.ts:28` |
| Analytics | Activities | Data read | Activity list for summaries | `useAnalytics.ts:28-31` |
| Analytics | Time Entries | Data read | Entry aggregation | `useAnalytics.ts:34-49` |
| Analytics | Theme | Color read | Chart colors per theme | `useThemeColors.ts` |
| Points Counter | Project Tasks | Computed read | Scans all incomplete tasks | `usePointsCounter.ts:11-13` |
| Points Counter | Settings | Config read | Visibility toggle | `usePointsCounter.ts:8` |
| Recurring Tasks | Project Tasks | Self-reference | Creates copies of completed recurring tasks | `useProjectTasks.ts:66-88`, `useRecurringTaskCheck.ts` |
| Gamification | Settings | State storage | Persists streak/XP in settings | `streak.ts:52-59` |
| Gamification | Multiple hooks | XP source | Called from 8 different hooks | See section above |
| Sync (REST) | Activities, Time Entries, Settings | Replication | Bidirectional LWW | `syncEngine.ts` |
| Vault Sync | All entities | Replication | Bidirectional file-based | `vault/vaultSync.ts` |
| Settings | All features | Configuration | Provides config to everything | `settingsStore.ts` |
| Theme | All UI | CSS cascade | CSS vars consumed by all components | `settingsStore.ts`, `index.css` |
| Navigation | Settings | Layout | Determines nav component | `AppShell.tsx` |
| Day Boundary | Settings, Timer, Analytics | Date logic | Shared logical date concept | `time.ts`, `useDayBoundary.ts` |

---

## Architectural Observations

### 1. The Timer Store is a Coordination Hub

Three separate features directly manipulate `useTimerStore`:
- `useTimer` (main timer hook)
- `usePomodoro` (Pomodoro work phases)
- `useTaskTimer` (task timer linked activity)

These can conflict. If Pomodoro is running with a linked activity and the user starts a task timer with a different linked activity, `timerStore.start()` will stop the Pomodoro's timer first (`timerStore.ts:25-27`). The Pomodoro hook does not detect this externally-triggered stop.

### 2. Duplicate Cascade Logic

Task deletion cascade to today tasks is implemented in three places:
- `useProjects.deleteProject()` -- cascades by `projectId`
- `useProjectTasks.deleteTask()` -- cascades by `projectTaskId`
- `TaskSelectionView` inline handler -- cascades by `projectTaskId`

The inline handler in TaskSelectionView duplicates the logic from useProjectTasks.deleteTask().

### 3. Direct DB Access vs Hooks

Several components bypass hooks and write directly to Dexie:
- InboxView creates ProjectTasks and Notes directly via `db.projectTasks.add()` and `db.notes.add()`
- TaskSelectionView creates tasks via `db.projectTasks.add()` and deletes with inline cascade logic
- This means those creates do NOT award XP (the hooks include `awardXP()` calls)

### 4. Settings Store as God Object

The settings store holds 30+ fields spanning:
- UI preferences (theme, zoom, nav, language)
- Feature config (day boundaries, task limits, procrastination words)
- Sync config (server URL, API key)
- Gamification state (XP, streaks)
- Vault config

All features depend on it. It's persisted to a single Dexie record on every update.

### 5. Two Sync Systems

The app has two independent sync mechanisms:
- **REST sync** (`syncEngine.ts`): Only syncs activities, timeEntries, settings. Simple LWW.
- **Vault sync** (`vault/vaultSync.ts`): Syncs everything to markdown/JSON files. Has full import/export + live file watching.

They operate independently and don't coordinate with each other.

### 6. Enrichment Pattern

Several hooks perform cross-table joins that Dexie doesn't natively support:
- `useTodayTasks` enriches with project + task data
- `useAllProjectTasks` groups tasks by project and folder
- These are imperative loops doing individual `db.get()` calls, not batch queries
