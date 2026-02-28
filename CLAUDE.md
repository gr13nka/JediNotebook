# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Full-stack productivity app: time tracking, task management, habit tracking, Pomodoro timer, mind maps, inbox, notes, analytics. Offline-first with optional multi-device sync.

**Tech Stack**: React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, Zustand 5, Dexie 4 (IndexedDB), Motion (animations), Recharts | Express 4, better-sqlite3, TSX runtime | Shared types in `/shared/`

## Commands

```bash
# Client dev (port 5173, proxies /api to :3000)
cd client && npm run dev

# Server dev (port 3000, auto-reload via tsx watch)
cd server && npm run dev

# Type check client
cd client && npx tsc --noEmit

# Build client
cd client && npm run build    # → client/dist/

# Production server (serves API + built client static files)
cd server && npm start

# Docker
docker compose up --build     # port 3000, SQLite persisted in timer-data volume
```

No test framework is configured. No linter is configured.

## File Structure

```
client/src/
├── App.tsx                  # Router (React Router v6, AnimatePresence transitions)
├── main.tsx                 # Entry point
├── index.css                # Global styles + theme CSS custom properties
├── components/
│   ├── activities/          # ActivityCard, ActivityForm, ActivityList, ActivityMenu
│   ├── analytics/           # DailyView, WeeklyView, MonthlyView, StreaksView
│   ├── fatigue/             # FatigueCheck (10-question fatigue scale)
│   ├── habits/              # HabitCard, HabitList, WeeklyTracker, AddHabitModal
│   ├── inbox/               # InboxView
│   ├── layout/              # AppShell, Sidebar, BottomNav, DesktopBottomNav, DropdownNav
│   ├── mindmap/             # MindMapView, MindMapCanvas, MindMapNode, MindMapToolbar, MindUnloadMode
│   ├── notes/               # NoteCard, NoteEditor, NoteList
│   ├── pomodoro/            # PomodoroTimer, PresetSelector, PresetFormModal
│   ├── progress/            # ProgressBar, CircularBar, SegmentedBar, ThickLinearBar
│   ├── projects/            # ProjectsView, ProjectTaskList, TaskItem, FileTree, RecurrenceEditor
│   ├── settings/            # ThemeToggle, CustomThemeEditor, NavPositionPicker, + 10 more
│   ├── taskSelection/       # TaskSelectionView, TaskGroupCard, PointsCounter
│   ├── timer/               # TimerDisplay, ManualEntry
│   ├── today/               # TodayTaskCard
│   └── ui/                  # Button, Card, Input, Modal, ConfirmModal, Toggle, ContextMenu, InfoTooltip, RotaryDial, ProcrastinationConfirmModal
├── db/                      # index.ts (Dexie schema), seed.ts (default data)
├── hooks/                   # 19 data hooks (useActivities, useTimer, useHabits, etc.)
├── i18n/                    # translations.ts (5 languages), useTranslation.ts
├── pages/                   # 10 page components (one per route)
├── stores/                  # 5 Zustand stores (timer, pomodoro, settings, projectUI, mindMapUI)
├── sync/                    # syncEngine.ts (pull-before-push REST sync)
├── utils/                   # uuid, time, colors, shadows, recurrence, markdown, procrastinationCheck
└── workers/                 # timer.worker.ts, pomodoro.worker.ts
server/src/
├── index.ts                 # Express server + route mounting
├── database.ts              # SQLite connection & table initialization
├── middleware/auth.ts        # API key validation
├── routes/                  # health.ts, sync.ts
└── services/syncService.ts  # LWW merge + conflict resolution
shared/
├── types.ts                 # All TypeScript interfaces, ThemeMode union, Language union
└── constants.ts             # DEFAULT_SETTINGS, DEFAULT_CUSTOM_THEME_COLORS, ACTIVITY_COLORS
```

## Architecture

- **Offline-first**: Dexie (IndexedDB) is the primary database. The server is entirely optional — only needed for multi-device sync.
- **Sync**: REST API with Last-Write-Wins (LWW) conflict resolution by `updatedAt` timestamp. Pull before push. **Only syncs activities, timeEntries, and settings** — habits, notes, projects, tasks, mind maps, inbox are local-only. Client: `sync/syncEngine.ts`. Server: `services/syncService.ts`.
- **State**: Zustand stores for timer/settings/pomodoro/projectUI/mindMapUI global state. Dexie `useLiveQuery()` for reactive data queries.
- **Routing**: React Router v6 in `App.tsx`. 10 routes wrapped in `AnimatePresence` for page transitions (y-axis slide + fade, 200ms).
- **Navigation**: Three modes (`navPosition` setting): `'left'` (sidebar), `'bottom'` (desktop bottom nav), `'dropdown'` (FAB + dropdown). Responsive — mobile always shows BottomNav (md breakpoint: 768px). Tabs can be hidden/reordered via context menu.
- **Workers**: Timer and Pomodoro ticks run in Web Workers (just count seconds, no DB/store access). Main thread coordinates everything. Singleton pattern prevents orphaned workers during HMR.
- **Soft deletes**: All entities use `deletedAt` field, never hard delete. Queries always filter `!deletedAt`. Cascade deletes (e.g., project → tasks → todayTasks) are handled in hooks, not the database.
- **Logical date**: Configurable day boundary (`dayStartHour`/`dayEndHour`). A "day" can span midnight (e.g., 6am to 2am). TimeEntry `date` field is always logical YYYY-MM-DD via `getLogicalDate()`.
- **Seeding**: `db/seed.ts` runs on first load — creates break activity, default settings, 4 default habits, 3 pomodoro presets. Idempotent (checks existence before adding).

## Routes

| Path | Page Component | Notes |
|------|---------------|-------|
| `/` | `HomePage` | Timer, activity list, fatigue check button, pomodoro access |
| `/projects` | `ProjectsPage` | Wide + full-bleed layout. Tabbed project editor with folders |
| `/tasks` | `TaskSelectionPage` | Wide layout. All tasks by project/folder, points counter |
| `/today` | `TodayPage` | Daily task list, completion tracking, focus mode overlay |
| `/inbox` | `InboxPage` | Quick-capture inbox for ideas/tasks |
| `/mindmap` | `MindMapPage` | Wide + full-bleed layout. Mind maps with "Mind Unload" mode |
| `/habits` | `HabitsPage` | Boolean & numeric habits, weekly tracker, streaks |
| `/analytics` | `AnalyticsPage` | 4 tabs: daily, weekly, monthly, streaks |
| `/notes` | `NotesPage` | Wide layout. Markdown notes with pin/sort |
| `/settings` | `SettingsPage` | 11 settings sections with staggered animation |

**Layout classes** in `AppShell.tsx`: `WIDE_PAGES` (`/projects`, `/tasks`, `/notes`, `/mindmap`) get `max-w-6xl`. `FULL_BLEED_PAGES` (`/projects`, `/mindmap`) get no padding/max-width.

## Database

**Dexie (client) — 13 tables** (schema version 8):

`activities`, `timeEntries`, `settings`, `habits`, `habitEntries`, `notes`, `pomodoroPresets`, `projects`, `projectTasks`, `todayTasks`, `projectFolders`, `inboxItems`, `mindMaps`

**SQLite (server) — 3 tables**: `activities`, `time_entries`, `user_settings` (only what syncs)

All records have: `id` (UUID v7, time-sortable), `createdAt`, `updatedAt`, `deletedAt`, `deviceId`.

`deviceId` comes from `getDeviceId()` (localStorage) — attached to every record for sync attribution.

**Schema version history**: v1 (activities, timeEntries, settings) → v2 (+habits, habitEntries) → v3 (+notes) → v4 (+pomodoroPresets) → v5 (+projects, projectTasks, todayTasks) → v6 (+projectFolders, folderId on projects, recurrence fields on tasks — has upgrade function) → v7 (+inboxItems) → v8 (+mindMaps). Only v6 has a custom upgrade function; others are index-only changes handled automatically by Dexie.

**Seeding** (`db/seed.ts`): On first load, creates break activity (`isBreak: true`), default settings record (id='default'), 4 habits (Meditate, Read, Steps, Water), 3 pomodoro presets (Classic 25/5, Long Focus 50/10, Short Sprint 15/3).

## Stores

5 Zustand stores in `client/src/stores/`:

| Store | Purpose | Key State |
|-------|---------|-----------|
| `timerStore` | Active timer lifecycle | `isRunning`, `elapsed`, `activeActivityId`, `startedAt`, `activeEntryId`. Actions: `start()`, `stop()`, `tick()`, `restore()` |
| `pomodoroStore` | Pomodoro work/break cycles | `isActive`, `isPaused`, `phase` ('work'\|'break'\|'longBreak'), `remainingSeconds`, `currentSession`, `linkedActivityId`, `selectedPresetId`. Actions: `startSession()`, `pause()`, `resume()`, `skip()`, `stop()`, `tick()` |
| `settingsStore` | User settings + theme + persistence | All settings fields (see below). Actions: `load()`, `update(patch)`. Internal: `applyTheme()`, `applyAccentColor()`, `applyZoom()` |
| `projectUIStore` | Project view UI state | `openTabs[]`, `activeTabId`, `sidebarCollapsed`, `splitDirection`. Actions: `openTab()`, `closeTab()`, `setActiveTab()`, `toggleSidebar()` |
| `mindMapUIStore` | Mind map view UI state | `activeMindMapId`, `selectedNodeId`, `mindUnloadActive`, `timerVisible`, `pendingEditNodeId` |

**Persistence**: `settingsStore` persists to Dexie settings table (id='default') on every `update()`. `timerStore` writes directly to `db.timeEntries`. Other stores are ephemeral (UI state only).

**Settings fields**: `dayStartHour` (6), `dayEndHour` (2), `timezone`, `theme` (ThemeMode), `language` (Language), `barStyle`, `uiZoom` (110), `accentColor`, `customThemeColors`, `navPosition` ('left'\|'bottom'\|'dropdown'), `hiddenNavTabs[]`, `navTabOrder[]`, `dropdownFabCorner`, `syncEnabled`, `syncServerUrl`, `syncApiKey`, `maxTasksPerProject` (5), `timerNotificationsEnabled`, `timerNotificationIntervalMinutes` (30), `pointsCounterVisible`, `pointsColorFixed`, `procrastinationWords[]`, `dismissedProcrastinationTaskIds[]`. Defaults in `shared/constants.ts` as `DEFAULT_SETTINGS`.

## Navigation System

Three modes controlled by `settingsStore.navPosition`:

| Mode | Desktop (≥768px) | Mobile (<768px) |
|------|-----------------|-----------------|
| `'left'` | Sidebar (collapsible 56–224px) | BottomNav |
| `'bottom'` | DesktopBottomNav (fixed h-14) | BottomNav |
| `'dropdown'` | DropdownNav (draggable FAB + menu) | DropdownNav |

**Tab management**: `hiddenNavTabs[]` hides routes, `navTabOrder[]` reorders them. Both configurable via right-click context menu on nav items. All nav components support drag-to-reorder.

**Mobile BottomNav**: 4 main tabs always visible (`/`, `/today`, `/projects`, `/habits`), 6 secondary tabs in "More" popup.

**AppShell** (`layout/AppShell.tsx`): Conditionally renders Sidebar/BottomNav/DesktopBottomNav/DropdownNav based on `navPosition`. Applies `WIDE_PAGES`/`FULL_BLEED_PAGES` layout classes per route.

## Theming System

11 themes via CSS custom properties on `<html>`:

| Theme | Class | Type |
|-------|-------|------|
| Light | (none — default) | Flat light |
| Dark | `dark` | Flat dark |
| 3D Light | `neu-light` | Neumorphic light |
| 3D Dark | `neu-dark` | Neumorphic dark |
| Dracula | `dracula` | Flat dark |
| Gruvbox | `gruvbox` | Flat dark |
| Nord | `nord` | Flat dark |
| Solarized | `solarized` | Flat dark |
| Catppuccin | `catppuccin` | Flat dark |
| Tokyo Night | `tokyonight` | Flat dark |
| Custom | `custom` | User-defined (inline CSS vars) |

**How it works**:
- `index.css` defines `--shadow-*` and `--color-*` CSS custom properties per `html.{class}` block
- `shadows.ts` exports `NEU` object mapping semantic names to `var(--shadow-*)` — components use `NEU.raised`, `NEU.pressed`, etc. via `style={{ boxShadow: NEU.xxx }}`
- `settingsStore.applyTheme()` toggles the class on `<html>`, clears any inline custom properties, then applies new ones for the `custom` theme
- Tailwind `@theme` block maps colors so components use utilities like `bg-bg-card`, `text-text-primary`
- Flat dark themes: all shadows transparent except `modal`/`tooltip`. Neumorphic themes: dual highlight+shadow.
- **Custom theme**: Colors are stored in `customThemeColors` (persisted in Dexie settings). Applied via `element.style.setProperty()` on `<html>` — no CSS class needed. A `custom` class is added as a marker for `getThemeSnapshot()`.
- **Accent color override**: `accentColor` (separate setting) overrides `--color-accent` from any theme, including custom. Always re-applied after theme switch.
- **Dark mode detection**: `useIsDark()` returns `theme !== 'light' && theme !== 'neu-light'` — all prebuilt dark themes + custom are treated as dark.

**Shadow tokens**: `raised`, `raisedSm`, `raisedLg`, `pressed`, `pressedSm`, `pressedDeep`, `sidebarRight`, `bottomNavUp`, `modal`, `tooltipSm`, `topBar`

**Color tokens** (12 colors — Tailwind classes `text-text-primary`, `bg-bg-card`, etc.): `bg-primary`, `bg-card`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `accent`, `accent-fg`, `green`, `red`, `bar-track`, `border` (+ `neu-light`, `neu-dark` for neumorphic only)

**Chart colors**: `useThemeColors()` in `hooks/useThemeColors.ts` returns `{ textPrimary, textSecondary, accent, bgPrimary, border, barTrack }` for Recharts. Each built-in theme has a hardcoded object; the custom theme reads from `settingsStore.customThemeColors`.

### How to Add a New Prebuilt Theme

6 files must be touched. Use an existing dark flat theme (e.g., Dracula) as a template:

1. **`shared/types.ts`** — Add the new ID to the `ThemeMode` union (e.g., `| 'mytheme'`).

2. **`client/src/index.css`** — Add an `html.mytheme { }` block after the other theme blocks. Define all 12 `--color-*` tokens + 11 `--shadow-*` tokens. For flat dark themes, copy the shadow values from `html.dark` (all transparent except modal/tooltip). Set `--color-neu-light`/`--color-neu-dark` to `transparent`.

3. **`client/src/stores/settingsStore.ts`** — Add `'mytheme'` to the `cl.remove(...)` list inside `applyTheme()`.

4. **`client/src/hooks/useThemeColors.ts`** — Add a `const MYTHEME = { textPrimary, textSecondary, accent, bgPrimary, border, barTrack }` object. Add `cl.contains('mytheme')` check in `getThemeSnapshot()` (before the `dark` fallback). Add a `case 'mytheme':` in `useThemeColors()`.

5. **`client/src/i18n/translations.ts`** — Add `'settings.themeMyTheme': 'My Theme'` to all 5 language blocks (en, zh, es, pt, ru). Theme proper names are typically untranslated.

6. **`client/src/components/settings/ThemeToggle.tsx`** — Add an entry to the `THEMES` array: `{ id: 'mytheme', labelKey: 'settings.themeMyTheme', bg: '...', card: '...', accent: '...' }`.

**Verify**: `cd client && npx tsc --noEmit` then `npm run build`.

### Custom Theme (User-Defined)

Users can create their own theme via Settings > Theme > Custom swatch. The `CustomThemeEditor` component (`settings/CustomThemeEditor.tsx`) shows native `<input type="color">` pickers for all 12 color tokens. Colors are stored in `settingsStore.customThemeColors` (type `CustomThemeColors` from `shared/types.ts`) and persisted to Dexie. Default colors are in `shared/constants.ts` as `DEFAULT_CUSTOM_THEME_COLORS`.

When the custom theme is active, `applyTheme('custom', colors)`:
1. Removes all theme classes from `<html>`
2. Clears any previous inline CSS properties
3. Adds `custom` class as a marker
4. Sets all 12 `--color-*` + 2 `--color-neu-*` properties via `element.style.setProperty()`

The `ThemeToggle` swatch for Custom renders dynamically using the user's stored `customThemeColors`.

## UI Components

Reusable components in `components/ui/`:

| Component | Shadow | Animation | Notes |
|-----------|--------|-----------|-------|
| `Card` | `NEU.raised` | Hover: `y: -6`, tap: `scale: 0.94` (spring 400/25) | `rounded-2xl bg-bg-card p-4`. Interactive only if `onClick` provided |
| `Button` | `NEU.raisedSm` (primary/secondary/danger), none (ghost) | — | 4 variants: `primary`, `secondary`, `ghost`, `danger`. 3 sizes: `sm`, `md`, `lg` |
| `Input` | `NEU.pressed` | — | `rounded-xl`, focus: `border-accent`. Optional `label` prop |
| `Modal` | `NEU.modal` on dialog, `NEU.pressedDeep` on backdrop | Scale 0.95→1 + opacity (spring 400/30) | `z-50`, body scroll lock, `max-w-md` |
| `Toggle` | `NEU.pressedSm` track, `NEU.raisedSm` thumb | Thumb x: 4→24 (spring 500/30) | Green when checked, optional label |
| `ContextMenu` | `NEU.modal` | Scale 0.95→1 (0.1s) | Fixed position, auto-adjusts to viewport bounds. Items: `danger?` prop for red |
| `ConfirmModal` | via Modal | via Modal | Wraps Modal with cancel/delete buttons |
| `InfoTooltip` | `NEU.tooltipSm` | Opacity + y (0.15s) | "i" button, auto-positions above/below |
| `RotaryDial` | — | Spring rotation | Circular dial input component |
| `ProcrastinationConfirmModal` | via Modal | — | 5-second countdown, disabled until 0 |

## Key Patterns

- **Hook pattern**: All data hooks (e.g., `useActivities()`) wrap `useLiveQuery()` for reactive queries and return `{ data[], createX, updateX, deleteX }`. Create always includes `generateId()`, `getDeviceId()`, timestamps. Delete always sets `deletedAt` (soft delete).
- **Cascade soft deletes**: Handled in hooks, not DB. E.g., `useProjects.deleteProject()` soft-deletes the project, then soft-deletes all its tasks, then soft-deletes all todayTasks referencing those tasks.
- **Enriched queries**: Some hooks join data — e.g., `useTodayTasks` enriches each todayTask with its project task title and project name. `useAllProjectTasks` groups tasks by project and folder.
- **Store persistence**: `settingsStore` persists to Dexie on every update via `db.settings.update()`.
- **Timer restore**: On app load, `timerStore.restore()` checks for `endedAt === null` entries to resume interrupted timers.
- **Worker singleton**: Timer/pomodoro workers use module-level variables to track the single worker instance, preventing orphaned workers during HMR/StrictMode double-mounts.
- **Settings migration**: `settingsStore.load()` handles legacy `darkMode` boolean → `theme` field and legacy `'notion'` → `'dark'` theme.
- **Settings pipeline**: Add field to `SettingsState` → add default in `DEFAULT_SETTINGS` (`shared/constants.ts`) → handle missing field in `load()` (fallback to default) → `update()` auto-persists → build UI in `components/settings/`.
- **Pomodoro phases**: Work → break/longBreak → work cycle. Long break every N sessions. Respects `autoStartBreaks`/`autoStartWork` flags.
- **Card component** (`ui/Card.tsx`): standard wrapper with `NEU.raised` shadow.
- **Responsive**: Sidebar on desktop, BottomNav on mobile (768px breakpoint).
- **Page transitions**: Motion `AnimatePresence` with y-axis slide + fade (200ms).
- **Animation springs**: Standard spring config: `stiffness: 400, damping: 25-30`. Toggle thumb: `stiffness: 500, damping: 30`. Sidebar collapse: `stiffness: 400, damping: 35`.

## Features

Beyond the core timer, the app includes:

- **Projects & Tasks**: Folder hierarchy, tabbed project editor, task recurrence (daily/weekly/monthly), drag-reorder, max tasks per project limit
- **Today View**: Pick tasks from projects into daily list, completion tracking, focus mode (fullscreen overlay), reordering
- **Habits**: Boolean (checkbox) and numeric (with target/unit) types, weekly tracker grid, streak calculation
- **Analytics**: Daily/weekly/monthly activity summaries via Recharts, streak analysis, 7-day averages
- **Notes**: Markdown-enabled (headings, bold, italic, code, links, lists), pin/sort, color-coded
- **Mind Maps**: Hierarchical node-based brainstorming, "Mind Unload" rapid-capture mode, focus countdown timer, export
- **Inbox**: Quick-capture for ideas/tasks, sort into projects
- **Pomodoro**: Work/break/long-break cycles, customizable presets, activity linking, auto-start options
- **Fatigue Check**: 10-question fatigue scale (FAS), scoring to distinguish laziness vs. burnout
- **Procrastination Checker**: Detects configurable risk keywords in task titles, 5-second countdown confirmation modal
- **Points/Staleness Counter**: Gamified scoring based on incomplete task age (quadratic formula), visibility toggle
- **Task Selection**: Unified view of all projects/tasks grouped by folder, bulk selection

## Utilities Reference

| File | Key Exports |
|------|-------------|
| `utils/uuid.ts` | `generateId()` (UUID v7), `getDeviceId()` (localStorage-backed) |
| `utils/time.ts` | `formatDuration()`, `formatDurationLong()`, `getLogicalDate()`, `getTodayRange()`, `getProgressRatio()`, `getOverfillColor()` |
| `utils/colors.ts` | `getNextColor()`, `resetColorIndex()` — cyclic color assignment from `ACTIVITY_COLORS` |
| `utils/shadows.ts` | `NEU` object (11 shadow tokens as CSS var references) |
| `utils/recurrence.ts` | `getNextOccurrenceDate()`, `shouldCreateRecurrence()` |
| `utils/markdown.ts` | `renderMarkdown()`, `renderLineMd()`, `stripMarkdown()` |
| `utils/procrastinationCheck.ts` | `isProcrastinationRisky()`, `getMatchedWords()` |

## Conventions

- Path alias: `@shared/*` → `../shared/*` (configured in vite.config.ts and tsconfig.json)
- Styles: Tailwind utility classes + inline `style={{ boxShadow: NEU.xxx }}` for shadows
- No hard deletes — always set `deletedAt`
- Timestamps are ISO 8601 strings
- All IDs are UUID v7 (time-sortable) via `generateId()`
- Color-coded entities: activities, projects, notes, habits all have a `color` field
- i18n: 5 languages (en, zh, es, pt, ru). `TranslationKey` type auto-derived from `en` keys. Add keys to all 5 language blocks in `i18n/translations.ts`.

## How to Add...

### New Page

1. **`shared/types.ts`** — No change needed (unless adding new data types).
2. **`client/src/pages/MyPage.tsx`** — Create page component.
3. **`client/src/App.tsx`** — Add `<Route path="/mypage" element={<MyPage />} />`.
4. **`client/src/components/layout/AppShell.tsx`** — Add to `WIDE_PAGES`/`FULL_BLEED_PAGES` if needed.
5. **Navigation** — Add nav item to `Sidebar.tsx`, `BottomNav.tsx`, `DesktopBottomNav.tsx`, and `DropdownNav.tsx` (all 4 share the same route list pattern).
6. **`client/src/i18n/translations.ts`** — Add `'nav.mypage': 'My Page'` to all 5 language blocks.

### New Dexie Table

1. **`shared/types.ts`** — Define the entity interface (must include `id`, `createdAt`, `updatedAt`, `deletedAt`, `deviceId`).
2. **`client/src/db/index.ts`** — Bump version number. Add table to new `.version(N).stores({ myTable: 'id, ...' })` call. Add `EntityTable` type declaration. If existing rows need migration, add `.upgrade(tx => ...)`.
3. **`client/src/hooks/useMyData.ts`** — Create hook wrapping `useLiveQuery()` with CRUD operations.
4. **`client/src/db/seed.ts`** — Optionally seed default data.

### New Settings Field

1. **`shared/constants.ts`** — Add default value to `DEFAULT_SETTINGS`.
2. **`client/src/stores/settingsStore.ts`** — Add field to `SettingsState` interface. In `load()`, add fallback: `myField: saved.myField ?? DEFAULT_SETTINGS.myField`.
3. **Build UI component** in `components/settings/` that reads from `settingsStore` and calls `settingsStore.getState().update({ myField: value })`.
4. **`client/src/pages/SettingsPage.tsx`** — Add component to the settings sections array.
5. **`client/src/i18n/translations.ts`** — Add label/description keys to all 5 language blocks.

### New Translation Keys

Add the key to all 5 language blocks in `i18n/translations.ts` (en, zh, es, pt, ru). `TranslationKey` is auto-derived as `keyof typeof en` — no manual type updates needed. Use `t('my.key')` via `useTranslation()` hook.

## API Endpoints

```
GET  /api/health                      → { status, timestamp }
GET  /api/sync/changes?since=ISO8601  → SyncResponse (pull)
POST /api/sync/changes                → { status, serverTime } (push)
     Header: X-API-Key (optional)
     Body: SyncPayload (activities[], timeEntries[], settings, lastSyncedAt)
```

Server LWW uses `INSERT ... ON CONFLICT(id) DO UPDATE` with per-field `CASE WHEN excluded.updatedAt > table.updatedAt` logic.
