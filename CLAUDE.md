# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Full-stack productivity app: time tracking, task management, habit tracking, Pomodoro timer. Offline-first with optional multi-device sync.

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

## Architecture

- **Offline-first**: Dexie (IndexedDB) is the primary database. The server is entirely optional — only needed for multi-device sync.
- **Sync**: REST API with Last-Write-Wins (LWW) conflict resolution by `updatedAt` timestamp. Pull before push. **Only syncs activities, timeEntries, and settings** — habits, notes, projects, tasks are local-only.
- **State**: Zustand stores for timer/settings/pomodoro global state. Dexie `useLiveQuery()` for reactive data queries.
- **Workers**: Timer and Pomodoro ticks run in Web Workers (just count seconds, no DB/store access). Main thread coordinates everything.
- **Soft deletes**: All entities use `deletedAt` field, never hard delete. Queries always filter `!deletedAt`. Cascade deletes (e.g., project → tasks → todayTasks) are handled in hooks, not the database.
- **Logical date**: Configurable day boundary (`dayStartHour`/`dayEndHour`). A "day" can span midnight (e.g., 6am to 2am). TimeEntry `date` field is always logical YYYY-MM-DD via `getLogicalDate()`.

## Database

**Dexie (client) — 11 tables**: `activities`, `timeEntries`, `settings`, `habits`, `habitEntries`, `notes`, `pomodoroPresets`, `projects`, `projectTasks`, `todayTasks`, `projectFolders`

**SQLite (server) — 3 tables**: `activities`, `time_entries`, `user_settings` (only what syncs)

All records have: `id` (UUID v7, time-sortable), `createdAt`, `updatedAt`, `deletedAt`, `deviceId`.

`deviceId` comes from `getDeviceId()` (localStorage) — attached to every record for sync attribution.

## Theming System

Four modes via CSS custom properties on `<html>`:

| Mode | Class | Style |
|------|-------|-------|
| Flat Light | (none — default) | Clean borders, light bg |
| Flat Dark | `dark` | Clean borders, dark bg |
| 3D Light | `neu-light` | Neumorphic dual shadows |
| 3D Dark | `neu-dark` | Neumorphic dual shadows |

**How it works**:
- `index.css` defines `--shadow-*` and `--color-*` CSS custom properties per theme block
- `shadows.ts` exports `NEU` object mapping semantic names to `var(--shadow-*)` — components use `NEU.raised`, `NEU.pressed`, etc. via `style={{ boxShadow: NEU.xxx }}`
- `settingsStore.applyTheme()` toggles the class on `<html>`
- Tailwind `@theme` block maps colors so components use utilities like `bg-bg-card`, `text-text-primary`
- Flat themes: shadows are transparent (no elevation except modal/tooltip). Neumorphic themes: dual highlight+shadow.

**Shadow tokens**: `raised`, `raisedSm`, `raisedLg`, `pressed`, `pressedSm`, `pressedDeep`, `sidebarRight`, `bottomNavUp`, `modal`, `tooltipSm`, `topBar`

**Color tokens** (Tailwind classes `text-text-primary`, `bg-bg-card`, etc.): `bg-primary`, `bg-card`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `accent`, `accent-fg`, `green`, `red`, `bar-track`, `border`, `neu-light`, `neu-dark`

## Key Patterns

- **Hook pattern**: All data hooks (e.g., `useActivities()`) wrap `useLiveQuery()` for reactive queries and return `{ data[], createX, updateX, deleteX }`. Create always includes `generateId()`, `getDeviceId()`, timestamps. Delete always sets `deletedAt` (soft delete).
- **Store persistence**: Zustand stores persist to Dexie on every update via `db.settings.update()`.
- **Timer restore**: On app load, `timerStore.restore()` checks for `endedAt === null` entries to resume interrupted timers.
- **Settings migration**: Code handles legacy `darkMode` boolean → `theme` field and legacy `'notion'` → `'dark'` theme.
- **Pomodoro phases**: Work → break/longBreak → work cycle. Long break every N sessions. Respects `autoStartBreaks`/`autoStartWork` flags.
- **Card component** (`ui/Card.tsx`): standard wrapper with `NEU.raised` shadow.
- **Responsive**: Sidebar on desktop, BottomNav on mobile.
- **Page transitions**: Motion `AnimatePresence` with y-axis slide + fade (200ms).

## Conventions

- Path alias: `@shared/*` → `../shared/*` (configured in vite.config.ts and tsconfig.json)
- Styles: Tailwind utility classes + inline `style={{ boxShadow: NEU.xxx }}` for shadows
- No hard deletes — always set `deletedAt`
- Timestamps are ISO 8601 strings
- All IDs are UUID v7 (time-sortable) via `generateId()`
- Color-coded entities: activities, projects, notes, habits all have a `color` field

## API Endpoints

```
GET  /api/health                      → { status, timestamp }
GET  /api/sync/changes?since=ISO8601  → SyncResponse (pull)
POST /api/sync/changes                → { status, serverTime } (push)
     Header: X-API-Key (optional)
     Body: SyncPayload (activities[], timeEntries[], settings, lastSyncedAt)
```

Server LWW uses `INSERT ... ON CONFLICT(id) DO UPDATE` with per-field `CASE WHEN excluded.updatedAt > table.updatedAt` logic.
