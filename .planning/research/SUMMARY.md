# Research Summary: JediNotebook Codebase Documentation

**Researched:** 2026-03-03
**Overall confidence:** HIGH (all source files read directly)
**Total documentation:** 4,025 lines across 4 research files

## Executive Summary

The JediNotebook app is larger and more complex than CLAUDE.md documents. Research uncovered **21 hooks** (not 19), **6 stores** (not 5), **14 Dexie tables** (not 13), **88 components** across 17 directories, and several undocumented features (gamification/XP system, task timer, vault sync, PDF documents).

Two distinct data paths exist: Dexie hooks with `useLiveQuery()` for automatic reactivity (15 of 21 hooks), and Zustand stores for high-frequency state that persists only at lifecycle boundaries.

## CLAUDE.md Discrepancies

| Area | CLAUDE.md Says | Actual |
|------|---------------|--------|
| Schema version | v8 | v9 (added pdfDocuments) |
| Table count | 13 | 14 (pdfDocuments added) |
| Store count | 5 | 6 (taskTimerStore undocumented) |
| Hook count | 19 | 21 (usePdfDocuments, useTaskTimer) |
| Gamification/XP | Not mentioned | Full system: 8 XP-awarding actions, streaks, levels |
| Task timer | Not mentioned | Countdown timer for today tasks with overtime tracking |
| Vault sync | Not mentioned | Second sync system alongside REST sync |
| Files to add a page | "4+" nav files | 7+ files (4 nav + App.tsx + AppShell + i18n + DropdownNav iconMap) |

## Key Architectural Findings

### Feature Interactions (25 connections mapped)
- **Timer Store is a coordination hub** — 3 features (main timer, Pomodoro, task timer) compete for it without coordination
- **Cascade soft-deletes are hook-only** — duplicated in 3 places for task deletion (useProjects, useProjectTasks, TaskSelectionView)
- **Settings Store is a god object** — 30+ fields, consumed by 35+ components, persisted as single Dexie record on every update
- **Two independent sync systems** — REST sync (3 entities) and Vault sync (all entities) don't coordinate
- **Inbox bypasses hooks** — direct DB writes miss XP awards

### Data Flows
- **Two data persistence paths:** Hook path (Dexie reactive) and Store path (Zustand high-frequency)
- **Write-through in useTodayTasks:** completing a today task writes to both todayTasks and projectTasks tables
- **Mind map scalability concern:** nodes stored as flat array — every operation requires full read/write of entire array
- **Two timer workers with different designs:** timer.worker self-corrects from absolute timestamp, pomodoro.worker just fires ticks

### Component Catalog (88 components)
- **12 reusable UI primitives** forming design system foundation
- **NEU shadow system:** `NEU.raisedSm` (40+ uses) and `NEU.pressedSm` (30+ uses) are most common
- **Motion spring configs:** standard `stiffness: 400, damping: 25-30`, tight `stiffness: 500, damping: 20-30`
- **`useSettingsStore`** consumed by 35+ components; `useTranslation` in 60+

### Dependencies & Pitfalls (16 pitfalls documented)
- **Settings type drift:** `UserSettings` in types.ts has ~14 fewer fields than actual `SettingsState`
- **No cascade for habit entries** when deleting a habit — potential orphaned data
- **`dayEndHour` is defined but never used** — dead code or planned feature
- **`lastSyncedAt` not persisted** — causes full re-sync on every page load

## Research Files

| File | Lines | Contents |
|------|-------|----------|
| `FEATURE_INTERACTIONS.md` | 971 | 25 feature connections, cascade chains, shared state matrix |
| `DATA_FLOWS.md` | 1,519 | 21 hooks, 6 stores, 12 feature flows, gamification system, sync flow |
| `COMPONENT_CATALOG.md` | 1,024 | 88 components with props, shadows, animations, usage, page composition |
| `DEPENDENCIES_AND_PITFALLS.md` | 461 | Dependency maps, 16 pitfalls, modification chains, CLAUDE.md accuracy report |

## Open Questions

1. Is `dayEndHour` intentionally unused (planned feature) or dead code?
2. Should `useTodayTasks` use logical date instead of calendar date?
3. Is the lack of cascade delete for habit entries intentional?
4. Should `lastSyncedAt` be persisted to avoid full re-sync?
5. Should the 3 timer-like features coordinate via a shared mechanism?
