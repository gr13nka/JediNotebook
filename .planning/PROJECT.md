# Web Timer — Comprehensive Documentation

## What This Is

A full-stack offline-first productivity app covering time tracking, task/project management, habit tracking, Pomodoro timer, mind maps, inbox capture, markdown notes, and analytics. Built with React 19 / TypeScript / Vite / Tailwind / Zustand / Dexie (IndexedDB), with optional Express + SQLite server for multi-device sync. This milestone focuses on creating deep codebase documentation so future feature work requires minimal codebase scanning.

## Core Value

Reduce per-session token cost by capturing the full state of the app — feature interactions, data flows, and component catalog — so Claude can add features or enhancements without re-reading source files.

## Requirements

### Validated

- ✓ Time tracking with start/stop timer and manual entry — existing
- ✓ Activity management (CRUD, color-coded, break activity) — existing
- ✓ Project & task management with folder hierarchy, tabbed editor, drag-reorder — existing
- ✓ Task recurrence (daily/weekly/monthly) — existing
- ✓ Today view with daily task picking, completion tracking, focus mode — existing
- ✓ Habit tracking (boolean & numeric types), weekly tracker, streaks — existing
- ✓ Pomodoro timer with work/break/long-break cycles, presets, activity linking — existing
- ✓ Mind maps with hierarchical nodes, Mind Unload rapid-capture mode — existing
- ✓ Inbox quick-capture for ideas/tasks — existing
- ✓ Markdown notes with pin/sort/color — existing
- ✓ Analytics (daily/weekly/monthly/streaks) via Recharts — existing
- ✓ Fatigue check (10-question FAS scale) — existing
- ✓ Procrastination checker with configurable keywords, countdown confirmation — existing
- ✓ Points/staleness counter (gamified task aging) — existing
- ✓ Task selection view (all tasks grouped by folder, bulk selection) — existing
- ✓ 11-theme system (light, dark, neumorphic, Dracula, Gruvbox, Nord, Solarized, Catppuccin, Tokyo Night, custom) — existing
- ✓ 3 navigation modes (sidebar, bottom nav, dropdown FAB) — existing
- ✓ Offline-first with optional REST sync (LWW conflict resolution) — existing
- ✓ i18n (5 languages: en, zh, es, pt, ru) — existing
- ✓ Web Workers for timer/pomodoro ticks — existing
- ✓ Soft deletes with cascade handling in hooks — existing
- ✓ Logical date system (configurable day boundary) — existing
- ✓ Settings persistence to Dexie with migration support — existing
- ✓ CLAUDE.md with architecture docs, how-to guides, conventions — existing

### Active

- [ ] Feature interaction map documenting how all features connect (pomodoro→activities, today→projects→tasks, cascade deletes, timer→timeEntries, etc.)
- [ ] Data flow documentation for each major feature path (hook → store → Dexie → component)
- [ ] UI component catalog with props, variants, shadow tokens, animation configs, and usage locations
- [ ] Cross-feature dependency graph (which hooks/stores/tables each feature touches)
- [ ] Hook reference with inputs, outputs, reactive queries, and side effects for all 19 data hooks
- [ ] Store interaction map showing how Zustand stores relate to Dexie tables and UI components
- [ ] Page composition reference (which components each page assembles, layout classes, route config)

### Out of Scope

- New app features — this milestone is documentation only, features come in future milestones
- Automated doc generation tooling — manual documentation captures intent better than auto-generated
- API/server documentation beyond what CLAUDE.md covers — server is simple, sync-only
- Test documentation — no test framework configured

## Context

- CLAUDE.md already covers: file structure, architecture overview, routing, theming (detailed), stores, database schema, seeding, conventions, how-to guides for adding pages/tables/settings/themes, API endpoints, utilities reference
- What CLAUDE.md misses: feature-to-feature interactions, detailed data flow per feature, component catalog beyond the ui/ folder, cross-cutting concerns like how cascade deletes propagate
- The app has ~19 data hooks, 5 Zustand stores, 13 Dexie tables, 10 pages, and dozens of feature components
- Typical future work: adding new pages (e.g., Review page in progress), enhancing existing pages (new settings, chart types), new data entities
- Staged/uncommitted work exists: ReviewPage, VaultSetupModal, and various component changes — documentation should capture committed state

## Constraints

- **Format**: Documentation lives in `.planning/` as markdown files readable by Claude without tooling
- **Scope**: Must complement CLAUDE.md, not duplicate it — reference CLAUDE.md for architecture/conventions, add depth on interactions and data flow
- **Accuracy**: All documentation must be verified against actual source code, not inferred from CLAUDE.md alone
- **Maintainability**: Docs should be structured so individual sections can be updated when features change, without rewriting everything

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skip codebase mapping | CLAUDE.md already provides thorough architecture docs | — Pending |
| Documentation-only milestone | Reduces future token cost before adding new features | — Pending |
| Complement CLAUDE.md, don't duplicate | Avoids drift between two sources of truth | — Pending |

---
*Last updated: 2026-03-03 after initialization*
