# Cross-Feature Dependencies & Pitfalls

**Project:** JediNotebook (productivity app)
**Researched:** 2026-03-03
**Confidence:** HIGH (all findings based on direct source code inspection)

---

## Cross-Feature Dependencies

### Table -> Hook Dependency Map

| Dexie Table | Primary Hook | Also Accessed By | Schema Version | Cascade Targets |
|---|---|---|---|---|
| `activities` | `useActivities` | `useTimer` (via timerStore), `useAnalytics`, `useTimeEntries` (FK), `useTodayTasks` (enrichment), `usePomodoro` (linked activity), `useTaskTimer` (linked activity), `syncEngine`, `db/seed.ts` | v1 | None |
| `timeEntries` | `useTimeEntries` | `useAnalytics`, `timerStore` (start/stop/restore), `syncEngine` | v1 | None |
| `settings` | `settingsStore` | `syncEngine`, `db/seed.ts`, `streak.ts` (awardXP reads/writes via settingsStore) | v1 | None |
| `habits` | `useHabits` | `db/seed.ts` | v2 | `habitEntries` (NOT cascaded -- orphaned entries remain) |
| `habitEntries` | `useHabits` | None | v2 | None |
| `notes` | `useNotes` | None | v3 | None |
| `pomodoroPresets` | `usePomodoroPresets` | `usePomodoro` (reads preset config), `db/seed.ts` | v4 | None |
| `projects` | `useProjects` | `useTodayTasks` (enrichment), `useAllProjectTasks`, `useFolders` (deleteFolder moves projects), `usePointsCounter` (indirect via projectTasks) | v5 | `projectTasks`, `todayTasks` (cascaded in `useProjects.deleteProject`) |
| `projectTasks` | `useProjectTasks` | `useTodayTasks` (enrichment + completion sync), `useAllProjectTasks`, `useRecurringTaskCheck`, `usePointsCounter`, `useProjects` (cascade delete) | v5 | `todayTasks` (cascaded in `useProjectTasks.deleteTask`) |
| `todayTasks` | `useTodayTasks` | `useProjectTasks` (cascade delete), `useProjects` (cascade delete), `useTaskTimer` (references todayTask IDs) | v5 | None |
| `projectFolders` | `useFolders` | `useAllProjectTasks` (grouping) | v6 | `projects` (un-folders, does NOT delete -- moves to root) |
| `inboxItems` | `useInbox` | None | v7 | None |
| `mindMaps` | `useMindMaps` | None | v8 | None (nodes stored inline in MindMap record) |
| `pdfDocuments` | `usePdfDocuments` | None | v9 | None |

### Critical: Cascade Soft-Delete Chains

These are the chains that MUST be executed when deleting parent entities. All cascades are implemented in hooks (NOT database triggers). Missing a cascade leaves orphaned records visible to users.

```
Project Delete (useProjects.deleteProject):
  project.deletedAt = now
  -> all projectTasks WHERE projectId = id -> deletedAt = now
  -> all todayTasks WHERE projectId = id -> deletedAt = now

Task Delete (useProjectTasks.deleteTask):
  projectTask.deletedAt = now
  -> all todayTasks WHERE projectTaskId = id -> deletedAt = now

Folder Delete (useFolders.deleteFolder):
  projectFolder.deletedAt = now
  -> all projects WHERE folderId = id -> folderId = null (MOVE, not delete)

Habit Delete (useHabits.deleteHabit):
  habit.deletedAt = now
  -> habitEntries are NOT cascaded (orphaned, but filtered by !deletedAt on habit)
  NOTE: This is a silent data leak. Orphaned habitEntries remain in IndexedDB.
```

**WARNING:** The cascade for `completeTask` in `useTodayTasks` syncs BIDIRECTIONALLY. When a todayTask is completed, it also updates the underlying `projectTask.isCompleted`. This is not a soft-delete cascade but a state-sync dependency.

```
TodayTask Complete (useTodayTasks.completeTask):
  todayTask.isCompleted = newCompleted
  -> projectTask WHERE id = todayTask.projectTaskId -> isCompleted = newCompleted
```

### Settings Field Impact Map

| Setting Field | Where Read | Affects | Side Effects | Notes |
|---|---|---|---|---|
| `dayStartHour` | `useTimeEntries`, `useTimer`, `usePomodoro`, `useTaskTimer`, `useDayBoundary`, `timerStore.start()`, `streak.ts` | What date a time entry is assigned to (`getLogicalDate()`). Changes the definition of "today". | Changing this mid-day can cause time entries to appear on wrong date in analytics | Core concept: if current hour < dayStartHour, date is treated as yesterday |
| `dayEndHour` | Only stored, not actively read in any hook | Appears unused in current codebase | Dead setting? Only appears in types and DEFAULT_SETTINGS | Potential bug or planned feature |
| `theme` | `settingsStore.update()`, `useThemeColors`, `useIsDark`, `useThemeMode` | CSS class on `<html>`, all component visual rendering | Triggers `applyTheme()` which mutates DOM classList + inline styles | Must sync with `darkMode` field (legacy) |
| `darkMode` | `settingsStore.update()` | Legacy toggle; auto-synced from `theme` | When setting `darkMode` directly (legacy), auto-maps to theme `'dark'` or `'light'` | Kept for backward compatibility. Always derived from theme. |
| `language` | `useTranslation` hook (everywhere) | All rendered text in the app | On first load, auto-detected from browser if not set | 5 supported: en, zh, es, pt, ru |
| `barStyle` | Progress bar components | Which progress bar variant renders | None | 3 options: thick-linear, segmented, circular |
| `syncEnabled` | `syncEngine.ts` | Whether sync happens at all | None | Must pair with `syncServerUrl` |
| `syncServerUrl` | `syncEngine.ts` | API target for sync | Trailing slash is stripped | Empty = sync disabled even if `syncEnabled` |
| `syncApiKey` | `syncEngine.ts` | X-API-Key header | Optional | Empty = no auth header sent |
| `maxTasksPerProject` | `ProjectTaskList` component | UI limit on task creation per project | None | Default 5. Enforced in UI only, not DB |
| `navPosition` | `AppShell.tsx` | Which nav component renders (Sidebar/BottomNav/DesktopBottomNav/DropdownNav) | Complete nav layout change | `'left'`, `'bottom'`, `'dropdown'` |
| `hiddenNavTabs` | All 4 nav components | Which tabs are visible | Persisted to Dexie | Array of route paths like `['/analytics', '/notes']` |
| `navTabOrder` | All 4 nav components | Tab ordering | Persisted to Dexie | Array of route paths in desired order |
| `dropdownFabCorner` | `DropdownNav` only | FAB button position | Persisted on drag-release | `'bottom-right'`, `'bottom-left'`, `'top-right'`, `'top-left'` |
| `timerNotificationsEnabled` | `useTimer` | Browser notifications every N minutes | Triggers Notification.requestPermission() | Requires browser permission |
| `timerNotificationIntervalMinutes` | `useTimer` | Notification frequency | None | Default 30 |
| `pointsCounterVisible` | `usePointsCounter` | Whether staleness score is shown | None | Default true |
| `pointsColorFixed` | Points UI components | Color scheme for points display | None | |
| `accentColor` | `settingsStore.update()` | `--color-accent` CSS variable override | Always re-applied AFTER theme switch (order matters) | Empty string = use theme default |
| `uiZoom` | `settingsStore.update()` | `<html>` font-size percentage | Affects all rem-based sizing | Default 110 |
| `customThemeColors` | `settingsStore`, `useThemeColors`, `CustomThemeEditor` | 12 CSS custom properties when theme = 'custom' | Applied via inline styles on `<html>` | Object with 12 color keys |
| `procrastinationWords` | `procrastinationCheck.ts` | Which task titles trigger confirmation modal | None | Default is Russian words |
| `dismissedProcrastinationTaskIds` | Procrastination check UI | Which tasks have been dismissed | Grows unbounded | Array of task IDs |
| `vaultEnabled` | `App.tsx`, Tauri-specific vault setup | Whether Obsidian-style vault sync is active | Triggers vault store initialization | Tauri-only feature |
| `vaultPath` | `App.tsx`, vault system | File system path for vault | None | Empty string = disabled |
| `vaultSetupDone` | `App.tsx` | Whether to show vault setup modal on launch | Blocks app rendering if false + Tauri | Tauri-only |
| `taskTimerMinutes` | `useTaskTimer` | Countdown duration for per-task timers | None | Default 20 |
| `gamificationEnabled` | `streak.ts` `awardXP()` | Whether XP/streaks are tracked | When false, `awardXP()` is a no-op | Default true |
| `currentStreak` | `streak.ts`, gamification UI | Current consecutive day streak | Updated on every XP award | Persisted in settings (NOT a separate table) |
| `longestStreak` | `streak.ts`, gamification UI | All-time longest streak | Updated when currentStreak exceeds it | |
| `lastActiveDate` | `streak.ts` | Date of last XP-earning action | Used to compute streak continuity | YYYY-MM-DD string |
| `totalXP` | `streak.ts`, gamification UI | Cumulative XP | Never decreases | |
| `todayXP` | `streak.ts`, gamification UI | XP earned today | Resets when `todayXPDate` != logical today | |
| `todayXPDate` | `streak.ts` | Date for todayXP tracking | Auto-updated | YYYY-MM-DD string |

### Theme System Dependency Chain

Adding a new prebuilt theme requires changes to exactly **6 files** (confirmed by code inspection):

| Step | File | What Changes | Verify |
|---|---|---|---|
| 1 | `shared/types.ts` | Add `'mytheme'` to `ThemeMode` union type | TypeScript compilation |
| 2 | `client/src/index.css` | Add `html.mytheme { }` block with all 12 `--color-*` tokens + 11 `--shadow-*` tokens | Visual inspection |
| 3 | `client/src/stores/settingsStore.ts` | Add `'mytheme'` to the `cl.remove(...)` list in `applyTheme()` (line 52) | Theme switching works |
| 4 | `client/src/hooks/useThemeColors.ts` | Add color constant object + `case 'mytheme':` in switch + `cl.contains('mytheme')` check in `getThemeSnapshot()` | Charts render with correct colors |
| 5 | `client/src/i18n/translations.ts` | Add `'settings.themeMyTheme': '...'` to all 5 language blocks | Theme name appears in settings |
| 6 | `client/src/components/settings/ThemeToggle.tsx` | Add entry to `THEMES` array with `{ id, labelKey, bg, card, accent }` | Theme swatch appears |

**Critical ordering dependencies:**
- `getThemeSnapshot()` in `useThemeColors.ts` checks CSS classes in a specific order. `'dark'` must be checked LAST among similar names because `classList.contains('dark')` would match `'neu-dark'` substring issues -- but since `classList.contains()` is exact match, this is safe. However, theme names must NOT be prefixes of other theme names.
- `applyTheme()` removes ALL theme classes before adding the new one. If you forget to add the new class name to the `cl.remove()` list, switching AWAY from the new theme will leave its class on `<html>`.
- `accentColor` is always re-applied after `applyTheme()`. This means the accent color override survives theme switches -- intentional design.

### Navigation System Dependency Chain

Adding a new page/route requires changes to these files:

| Step | File | What Changes | Notes |
|---|---|---|---|
| 1 | `client/src/pages/MyPage.tsx` | Create page component | Standard React component |
| 2 | `client/src/App.tsx` | Add `<Route path="/mypage" element={<MyPage />} />` | Import + route entry |
| 3 | `client/src/components/layout/AppShell.tsx` | Add to `WIDE_PAGES` and/or `FULL_BLEED_PAGES` if needed | Affects max-width and padding |
| 4 | `client/src/components/layout/Sidebar.tsx` | Add to `allNavItems` array with route, label key, icon | Must match route path exactly |
| 5 | `client/src/components/layout/BottomNav.tsx` | Add to `allMainNavItems` OR `allMoreNavItems` | Main = always visible bottom bar; More = popup menu |
| 6 | `client/src/components/layout/DesktopBottomNav.tsx` | Add to `allNavItems` array | Same as Sidebar format |
| 7 | `client/src/components/layout/DropdownNav.tsx` | Add to `allNavItems` array AND `iconMap` record | DropdownNav has an extra `iconMap` for FAB icon lookup |
| 8 | `client/src/i18n/translations.ts` | Add `'nav.mypage': '...'` to all 5 language blocks | Used by all nav components |

**Discovered discrepancy vs CLAUDE.md:** CLAUDE.md says "4+ files" for navigation. The actual count is **7 files minimum** (4 nav components + App.tsx + i18n + AppShell). DropdownNav has an additional `iconMap` that is easy to miss.

**Current route/nav item inventory (verified from code):**

| Route | Nav Label Key | In All 4 Navs | BottomNav Placement |
|---|---|---|---|
| `/` | `nav.tracking` | Yes | Main |
| `/projects` | `nav.projects` | Yes | Main |
| `/tasks` | `nav.taskSelection` | Yes | More |
| `/today` | `nav.today` | Yes | Main |
| `/inbox` | `nav.inbox` | Yes | More |
| `/mindmap` | `nav.mindmap` | Yes | More |
| `/habits` | `nav.habits` | Yes | Main |
| `/analytics` | `nav.analytics` | Yes | More |
| `/notes` | `nav.ideas` | Yes | More |
| `/review` | `nav.review` | Yes | More |
| `/settings` | `nav.settings` | Yes | More |

**NOTE:** The `/notes` route uses label key `nav.ideas` (not `nav.notes`). This is intentional but potentially confusing.

### i18n Dependency Chain

**How it works:**
1. `translations.ts` exports 5 objects: `en`, `zh`, `es`, `pt`, `ru`
2. `TranslationKey` is auto-derived as `keyof typeof en` -- no manual type maintenance
3. `useTranslation()` hook returns `t(key)` function
4. Adding a key to `en` but not to other languages = TypeScript error at compile time (all objects must have identical keys)

**Files that must change together:**
- `client/src/i18n/translations.ts` -- all 5 language blocks (en, zh, es, pt, ru)
- Any component using `t('new.key')` -- auto-typed via `TranslationKey`

**Gotcha:** The `en` object is the source of truth for `TranslationKey`. If you add a key only to non-English blocks, it won't be in the type and TypeScript will flag uses.

### Store Dependency Map

| Store | Persisted | Tables Accessed | Other Stores Read | Used By |
|---|---|---|---|---|
| `timerStore` | Yes (via `db.timeEntries`) | `timeEntries` | None | `useTimer`, `usePomodoro`, `useTaskTimer` |
| `pomodoroStore` | No (ephemeral) | None | None directly | `usePomodoro` |
| `settingsStore` | Yes (via `db.settings`) | `settings` | None | Nearly everything |
| `projectUIStore` | No (ephemeral) | None | None | Projects page UI |
| `mindMapUIStore` | No (ephemeral) | None | None | MindMap page UI |
| `taskTimerStore` | No (ephemeral) | None | None | `useTaskTimer` |

**Cross-store interactions (critical):**
- `usePomodoro` reads/writes `timerStore` AND `settingsStore` (dayStartHour). When a pomodoro work phase starts, it starts the activity timer. When work ends, it stops it.
- `useTaskTimer` reads/writes `timerStore` AND `settingsStore`. When a task timer starts with a linked activity, it starts the activity timer. On stop, it stops the activity timer.
- `streak.ts` `awardXP()` reads AND writes `settingsStore`. This function is called from 8 hooks: timerStore, useProjects, useTodayTasks, useMindMaps, useHabits, useInbox, useNotes, useProjectTasks.

### Sync Boundary

**What syncs (server):** `activities`, `timeEntries`, `settings` -- ONLY these 3 tables.

**What is local-only:** `habits`, `habitEntries`, `notes`, `pomodoroPresets`, `projects`, `projectTasks`, `todayTasks`, `projectFolders`, `inboxItems`, `mindMaps`, `pdfDocuments` -- 11 tables.

**Implication:** Multi-device users will lose all project/task/habit/note/mindmap data if they switch devices. Only timer data + activities + settings sync.

**Sync protocol:**
1. Pull from server (GET with `since` timestamp)
2. Apply server changes locally (LWW by `updatedAt`)
3. Push local changes (POST)
4. `lastSyncedAt` is module-level variable (NOT persisted -- resets on page reload)

**Sync gotcha:** The `lastSyncedAt` variable in `syncEngine.ts` is a module-level `let`, initialized to epoch. On every page load, the first sync will pull ALL server data. This is by design but can be slow with large datasets.

---

## Pitfalls & Gotchas

### Critical Pitfalls

#### 1. Settings Field Addition Pipeline (5-step requirement)

**What goes wrong:** Adding a new settings field without following all 5 steps causes the field to either not load, not persist, or crash.

**The 5 steps:**
1. Add default value to `DEFAULT_SETTINGS` in `shared/constants.ts`
2. Add field to `SettingsState` interface in `settingsStore.ts`
3. Add `raw.fieldName ?? DEFAULT_SETTINGS.fieldName` fallback in `load()` method
4. Build UI component that reads and writes via `settingsStore.update()`
5. Add translation keys if the UI needs labels

**What breaks if you skip step 3:** Existing users (who have a settings record in Dexie without the new field) will get `undefined` for the field, potentially crashing components that expect a value.

**Discovered discrepancy:** `UserSettings` in `shared/types.ts` is OUT OF SYNC with `SettingsState` in `settingsStore.ts`. The types.ts interface is missing several fields that exist in the store: `uiZoom`, `hiddenNavTabs`, `navTabOrder`, `dropdownFabCorner`, `customThemeColors`, `pointsColorFixed`, `taskTimerMinutes`, `currentStreak`, `longestStreak`, `lastActiveDate`, `totalXP`, `todayXP`, `todayXPDate`, `gamificationEnabled`. This means `UserSettings` is used for sync payload typing only (which only syncs basic settings). The actual runtime type is `SettingsState`. Modifying `UserSettings` expecting it to match the full settings shape is a common mistake.

#### 2. Dexie Schema Versioning Minefield

**What goes wrong:** Incorrectly bumping the Dexie version or forgetting to re-declare ALL tables.

**Rules:**
- Every `.version(N).stores({})` call must include ALL tables, not just new/changed ones. Dexie requires the full schema declaration at each version.
- Only add `.upgrade()` functions when you need to transform existing data. Index-only changes (adding indices or tables) are handled automatically.
- The version number must be strictly incrementing. Current version: **9** (CLAUDE.md says 8 -- it is outdated).
- Version 6 is the only version with a custom `.upgrade()` function (adds `folderId` to projects, `recurrenceRule`/`lastRecurredDate` to projectTasks).

**Current table count:** 14 tables (CLAUDE.md says 13 -- `pdfDocuments` was added in v9 and is not documented in CLAUDE.md).

#### 3. Worker Singleton Pattern and HMR/StrictMode Double-Mount

**What goes wrong:** React StrictMode double-mounts components. If workers are created inside useEffect, you get duplicate workers ticking simultaneously, doubling the timer speed.

**Prevention pattern (used in code):**
```typescript
// Module-level singleton -- survives re-mounts
let timerWorker: Worker | null = null;

function getTimerWorker(): Worker {
  if (!timerWorker) {
    timerWorker = new Worker(
      new URL('../workers/timer.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return timerWorker;
}
```

**Where this pattern is used:**
- `useTimer.ts` -- timer worker (module-level `let timerWorker`)
- `useTaskTimer.ts` -- task timer worker (module-level `let taskTimerWorker` + separate `workerListenerAttached` flag)

**Where this pattern is NOT used (potential issue):**
- `usePomodoro.ts` -- creates worker inside `useEffect` with `workerRef.current`. This uses a React ref, which survives re-renders but NOT HMR module replacement. The worker could leak on HMR. However, since `usePomodoro` checks `workerRef.current` before creating, it is safe for StrictMode double-mount.

#### 4. Timer Restore on App Load

**What goes wrong:** If the app crashes or is closed while a timer is running, the `endedAt` field on the active `timeEntry` is `null`. On next load, `timerStore.restore()` scans for `endedAt === null` entries and resumes the timer.

**Gotcha:** If there are multiple entries with `endedAt === null` (e.g., due to a bug or interrupted sync), `restore()` takes `.first()` -- only one is resumed, others are orphaned with `endedAt === null` forever.

**Gotcha 2:** The elapsed time is recalculated from `startedAt` to `Date.now()`. If the app was closed for days, the timer will show days of elapsed time. There is no maximum duration check.

#### 5. Theme Application Order

**What goes wrong:** The accent color override is applied as a separate step AFTER theme application. If you change the order or forget to re-apply accent color after theme switch, the accent resets to theme default.

**Correct order (in `settingsStore.update()`):**
1. Set state via `set(patch)`
2. If theme changed: `applyTheme(theme, customColors)` -- sets CSS class + custom theme vars
3. Re-apply accent: `applyAccentColor(accentColor)` -- overrides `--color-accent`
4. If customThemeColors changed (and theme is 'custom'): `applyCustomTheme(colors)` then re-apply accent

**Gotcha:** Both `applyTheme()` and `applyCustomTheme()` can set `--color-accent`. The accent color override must always be applied LAST to win.

### Moderate Pitfalls

#### 6. useTodayTasks Does NOT Use Logical Date

**What goes wrong:** `useTodayTasks.getTodayDate()` uses `new Date().toISOString().slice(0, 10)` which is the CALENDAR date, NOT the logical date. But `useTimeEntries` uses `getLogicalDate(dayStartHour)`.

This means if `dayStartHour` is 6 and it is 1:00 AM:
- Timer entries will be assigned to YESTERDAY (logical date)
- Today tasks will show for TODAY (calendar date)

This is likely intentional (tasks are day-planned, not hour-boundary-dependent) but could confuse users who expect consistency.

#### 7. Recurring Task Check Runs Once on Mount Only

**What goes wrong:** `useRecurringTaskCheck()` in `App.tsx` runs `useEffect` with `[]` deps -- it only checks for recurring tasks to create on initial app load. If the user keeps the app open past midnight, new recurring tasks will not be created until the next page refresh.

#### 8. Pomodoro-Timer-Activity Triple Coupling

**What goes wrong:** The Pomodoro timer can link to an activity and auto-start/stop the activity timer. The Task Timer can also link to an activity. If both Pomodoro and Task Timer are active with the same linked activity, they will fight over the activity timer state.

**Example scenario:**
1. Start Pomodoro linked to "Coding" activity
2. Pomodoro starts activity timer for "Coding"
3. Start Task Timer linked to "Coding" activity (from Today page)
4. Task Timer tries to start activity timer, but it is already running for "Coding"
5. Stop Pomodoro -> stops "Coding" activity timer
6. Task Timer is still running, but activity timer is now stopped

There is no mutex or coordination between Pomodoro and Task Timer for linked activity control.

#### 9. Nav Item Lists Are Duplicated 4 Times

**What goes wrong:** The `allNavItems` arrays in Sidebar, BottomNav, DesktopBottomNav, and DropdownNav are independently defined. Adding a page to one but not all four means inconsistent navigation across nav modes.

**Additionally:** BottomNav splits items into `allMainNavItems` (4 items) and `allMoreNavItems` (7 items). Other nav components use a single `allNavItems` list. This split is not obvious and can lead to items appearing in the wrong section on mobile.

#### 10. TypeScript Type Drift Between shared/types.ts and Store/Hook Reality

**What goes wrong:** The `UserSettings` type in `shared/types.ts` only includes fields relevant to sync. Many settings fields exist only in `SettingsState` (store interface) and `DEFAULT_SETTINGS` (constants). Treating `UserSettings` as the canonical settings type leads to missing fields.

**Fields in `SettingsState` but NOT in `UserSettings` (verified):**
- `uiZoom`, `hiddenNavTabs[]`, `navTabOrder[]`, `dropdownFabCorner`, `customThemeColors`, `pointsColorFixed`, `taskTimerMinutes`, `currentStreak`, `longestStreak`, `lastActiveDate`, `totalXP`, `todayXP`, `todayXPDate`, `gamificationEnabled`

These fields are all stored in Dexie settings (via `db.settings.update()`) but not typed in the `UserSettings` interface. They are stored as untyped extra properties on the Dexie record (Dexie is schemaless for non-indexed fields).

### Minor Pitfalls

#### 11. Seed Database Runs Synchronously at Import Time

`seedDatabase()` is called in `main.tsx` BEFORE `ReactDOM.createRoot()`. It is async but not awaited. This means:
- Seed runs concurrently with initial render
- If the app renders before seeding completes, the first render may show empty data
- In practice this is rarely an issue since IndexedDB operations are fast

#### 12. SVG Icons Duplicated Across All Nav Components

Each of the 4 nav components (Sidebar, BottomNav, DesktopBottomNav, DropdownNav) defines its own copies of all 11 SVG icon components. They differ only in size (18x18 vs 20x20). Any icon change must be replicated 4 times (plus DropdownNav's `iconMap`).

#### 13. `dayEndHour` Setting Appears Unused

The `dayEndHour` field exists in `DEFAULT_SETTINGS`, `UserSettings`, and `SettingsState`, but no hook or utility reads it. The logical date calculation only uses `dayStartHour`. This is either a planned feature or dead code.

#### 14. Procrastination Words Default to Russian

`DEFAULT_PROCRASTINATION_WORDS` in `shared/constants.ts` contains only Russian words. English-speaking users get a non-functional procrastination checker by default unless they customize the word list.

#### 15. `lastSyncedAt` Not Persisted

The `lastSyncedAt` in `syncEngine.ts` is a module-level variable initialized to epoch (`1970-01-01`). On page reload, the full sync pulls everything from the server again. For apps with many time entries, this creates unnecessary data transfer.

#### 16. PDF Documents Store Blobs in IndexedDB

`PdfDocument` stores `pdfData: Blob` directly in IndexedDB. Large PDFs can significantly increase IndexedDB size and affect Dexie performance. There is no file size limit enforced.

---

## Undocumented Conventions

### Features Not in CLAUDE.md

1. **Gamification System (XP + Streaks):** An entire gamification layer exists via `utils/streak.ts`. The `awardXP()` function is called from 8 different hooks. XP values, streak tracking, and level calculations are implemented. UI components exist in `components/gamification/`. Settings fields for gamification (6 fields) are in settingsStore.

2. **Task Timer:** A per-task countdown timer (`useTaskTimer` + `taskTimerStore`) exists separately from the Pomodoro timer. It links to today tasks and can start/stop activity timers. Uses the same pomodoro worker for ticking.

3. **Vault System:** A Tauri-specific Obsidian-style vault sync system exists in `client/src/vault/`. It includes `vaultStore`, `vaultSync`, `vaultBackend`, `tauriBackend`, `memoryBackend`, `writeQueue`, `webExport`, and `platform` modules. Controlled by `vaultEnabled`/`vaultPath`/`vaultSetupDone` settings. Blocks app rendering if Tauri + vault not set up.

4. **PDF Documents:** A `pdfDocuments` table (v9) and `usePdfDocuments` hook exist for storing and managing PDF files. Includes pin/sort functionality similar to notes.

5. **Review Page:** A `/review` route exists in App.tsx with a `ReviewPage` component and nav entries in all 4 nav components.

6. **6 Stores, Not 5:** CLAUDE.md documents 5 Zustand stores but there are actually 6: `timerStore`, `pomodoroStore`, `settingsStore`, `projectUIStore`, `mindMapUIStore`, and `taskTimerStore`.

7. **SidebarStore:** A seventh Zustand store (`useSidebarStore`) is defined INSIDE `Sidebar.tsx` (not in the stores directory). It manages `collapsed` state and is imported by `AppShell.tsx`.

### Pattern: XP Award on CRUD Actions

Nearly every data-mutating hook awards XP via `awardXP(XP_VALUES.xxx)`:

| Action | XP | Hook |
|---|---|---|
| Complete task | 15 | useTodayTasks, useProjectTasks |
| Check habit | 10 | useHabits |
| Stop timer (>= 60s) | 10 | timerStore |
| Create note | 10 | useNotes |
| Create task | 5 | useProjectTasks |
| Add inbox item | 5 | useInbox |
| Create mind map | 5 | useMindMaps |
| Create project | 5 | useProjects |

**Convention:** Any new hook that creates/completes entities should call `awardXP()` with an appropriate value from `XP_VALUES`.

### Pattern: Linked Activity ID

Projects can have a `linkedActivityId` field. When a today task is started via the task timer, it can auto-start the linked activity's timer. This creates a chain: Project -> linkedActivityId -> Activity -> timerStore. The `useTodayTasks` enrichment explicitly includes `linkedActivityId` from the project.

### CLAUDE.md Accuracy Report

| Claim | Status | Notes |
|---|---|---|
| "13 tables" | OUTDATED | 14 tables (pdfDocuments added in v9) |
| "Schema version 8" | OUTDATED | Current version is 9 |
| "5 Zustand stores" | OUTDATED | 6 stores (+ sidebarStore in component) |
| "10 routes" | OUTDATED | 11 routes (/review added) |
| "Only v6 has custom upgrade" | CORRECT | v6 is still the only version with .upgrade() |
| "4 files for nav" | INCOMPLETE | Actually 7 files (4 nav + App.tsx + AppShell + i18n) |
| "6 files for theme" | CORRECT | Verified all 6 |
| "Sync only activities, timeEntries, settings" | CORRECT | Verified in syncEngine.ts |
| "Soft deletes, never hard delete" | CORRECT | All hooks use deletedAt pattern |
| "Worker singleton pattern" | MOSTLY CORRECT | Timer and TaskTimer use module-level singletons. Pomodoro uses useRef. |

---

## Quick Reference: "What Must Change Together"

### Add a New Dexie Table
1. `shared/types.ts` -- define interface
2. `client/src/db/index.ts` -- bump version, add to new `.version(N).stores({})` with ALL tables
3. `client/src/db/index.ts` -- add `EntityTable` type to db cast
4. `client/src/hooks/useMyData.ts` -- create hook
5. (Optional) `client/src/db/seed.ts` -- seed defaults

### Add a New Settings Field
1. `shared/constants.ts` -- add to `DEFAULT_SETTINGS`
2. `client/src/stores/settingsStore.ts` -- add to `SettingsState` interface
3. `client/src/stores/settingsStore.ts` -- add `raw.field ?? DEFAULT_SETTINGS.field` in `load()`
4. Build UI in `components/settings/`
5. `client/src/i18n/translations.ts` -- add labels in all 5 languages
6. (If syncable) `shared/types.ts` -- add to `UserSettings`

### Add a New Page
1. `client/src/pages/MyPage.tsx` -- create page
2. `client/src/App.tsx` -- add Route
3. `client/src/components/layout/AppShell.tsx` -- add to WIDE_PAGES/FULL_BLEED_PAGES if needed
4. `client/src/components/layout/Sidebar.tsx` -- add to allNavItems
5. `client/src/components/layout/BottomNav.tsx` -- add to allMainNavItems OR allMoreNavItems
6. `client/src/components/layout/DesktopBottomNav.tsx` -- add to allNavItems
7. `client/src/components/layout/DropdownNav.tsx` -- add to allNavItems AND iconMap
8. `client/src/i18n/translations.ts` -- add nav label in all 5 languages

### Add a New Theme
1. `shared/types.ts` -- add to ThemeMode union
2. `client/src/index.css` -- add html.mytheme {} block
3. `client/src/stores/settingsStore.ts` -- add to cl.remove() list
4. `client/src/hooks/useThemeColors.ts` -- add color constant + case in switch + check in getThemeSnapshot()
5. `client/src/i18n/translations.ts` -- add theme name in all 5 languages
6. `client/src/components/settings/ThemeToggle.tsx` -- add to THEMES array

### Delete a Project (Cascade)
Hook: `useProjects.deleteProject(id)`
1. Soft-delete project
2. Soft-delete all projectTasks with projectId
3. Soft-delete all todayTasks with projectId

### Delete a Task (Cascade)
Hook: `useProjectTasks.deleteTask(id)`
1. Soft-delete projectTask
2. Soft-delete all todayTasks with projectTaskId

### Delete a Folder (Cascade)
Hook: `useFolders.deleteFolder(id)`
1. Soft-delete folder
2. Move (NOT delete) all projects with folderId to root (folderId = null)
