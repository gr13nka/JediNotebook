import { describe, it, expect } from 'vitest';
import { computeCleanup, type CleanupParams } from './cleanup';
import type { ProjectTask } from '@shared/types';

const TODAY = '2026-07-21';
const DAY_START = 6;

type TaskInput = CleanupParams['tasks'][number];

/**
 * Local-time instant serialized to ISO — mirrors how the app stamps
 * `completedAt`/`archivedAt` (`new Date().toISOString()`), and keeps every
 * case timezone-independent: the local components are fixed, so
 * `getLogicalDate`'s local-hour comparison sees the same values under any TZ.
 */
function iso(y: number, month: number, d: number, h = 12, min = 0): string {
  return new Date(y, month - 1, d, h, min).toISOString();
}

function task(overrides: Partial<TaskInput> & { id: string }): TaskInput {
  return {
    isCompleted: false,
    completedAt: null,
    updatedAt: iso(2026, 7, 1),
    archivedAt: null,
    recurrenceRule: null,
    ...overrides,
  };
}

function run(
  tasks: TaskInput[],
  archiveCompletedAfterDays: number | null,
  deleteArchivedAfterDays: number | null,
) {
  return computeCleanup({
    today: TODAY,
    dayStartHour: DAY_START,
    archiveCompletedAfterDays,
    deleteArchivedAfterDays,
    tasks,
  });
}

describe('computeCleanup', () => {
  it('returns everything empty when both stages are off (null thresholds)', () => {
    const tasks = [
      task({ id: 't1', isCompleted: true, completedAt: iso(2026, 6, 1) }),
      task({ id: 't2', isCompleted: true, completedAt: iso(2026, 6, 1), archivedAt: iso(2026, 6, 2) }),
    ];
    expect(run(tasks, null, null)).toEqual({ toArchive: [], toDelete: [] });
  });

  // ─── Archive stage ────────────────────────────────────────────────

  it('archives a task completed today when the threshold is 0 (immediate mode)', () => {
    const tasks = [task({ id: 't1', isCompleted: true, completedAt: iso(2026, 7, 21) })];
    expect(run(tasks, 0, null)).toEqual({ toArchive: ['t1'], toDelete: [] });
  });

  it('at threshold 1, archives a task completed yesterday but not one completed today', () => {
    const tasks = [
      task({ id: 'yesterday', isCompleted: true, completedAt: iso(2026, 7, 20) }),
      task({ id: 'today', isCompleted: true, completedAt: iso(2026, 7, 21) }),
    ];
    expect(run(tasks, 1, null)).toEqual({ toArchive: ['yesterday'], toDelete: [] });
  });

  it('at threshold N, archives at exactly N days old but not at N-1', () => {
    const tasks = [
      task({ id: 'at-n', isCompleted: true, completedAt: iso(2026, 7, 14) }), // 7 days
      task({ id: 'at-n-minus-1', isCompleted: true, completedAt: iso(2026, 7, 15) }), // 6 days
    ];
    expect(run(tasks, 7, null)).toEqual({ toArchive: ['at-n'], toDelete: [] });
  });

  it('places a 23:30 completion on that same logical day (dayStartHour 6)', () => {
    // Completed 2026-07-20 23:30 local — after dayStartHour, so logical
    // 2026-07-20: exactly 1 day before TODAY, archives at threshold 1.
    const tasks = [task({ id: 't1', isCompleted: true, completedAt: iso(2026, 7, 20, 23, 30) })];
    expect(run(tasks, 1, null)).toEqual({ toArchive: ['t1'], toDelete: [] });
  });

  it('places a 02:00 completion on the previous logical day (dayStartHour 6)', () => {
    // Completed 2026-07-21 02:00 local — before dayStartHour, so it belongs
    // to logical 2026-07-20 and already archives at threshold 1, even though
    // the wall-clock date is TODAY.
    const tasks = [task({ id: 't1', isCompleted: true, completedAt: iso(2026, 7, 21, 2, 0) })];
    expect(run(tasks, 1, null)).toEqual({ toArchive: ['t1'], toDelete: [] });
  });

  it('falls back to updatedAt when completedAt is null (legacy/vault rows)', () => {
    const tasks = [
      task({ id: 'old', isCompleted: true, completedAt: null, updatedAt: iso(2026, 7, 20) }),
      task({ id: 'fresh', isCompleted: true, completedAt: null, updatedAt: iso(2026, 7, 21) }),
    ];
    expect(run(tasks, 1, null)).toEqual({ toArchive: ['old'], toDelete: [] });
  });

  it('never archives an incomplete task, no matter how old', () => {
    const tasks = [task({ id: 't1', isCompleted: false, updatedAt: iso(2026, 1, 1) })];
    expect(run(tasks, 0, null)).toEqual({ toArchive: [], toDelete: [] });
  });

  it('skips an already-archived task in the archive stage (lists stay disjoint)', () => {
    const tasks = [
      task({
        id: 't1',
        isCompleted: true,
        completedAt: iso(2026, 7, 1),
        archivedAt: iso(2026, 7, 20),
      }),
    ];
    expect(run(tasks, 1, null)).toEqual({ toArchive: [], toDelete: [] });
  });

  it('treats a runtime-undefined archivedAt (pre-feature Dexie row) as not archived', () => {
    // Rows written before the archive feature existed have no archivedAt key
    // at all. The Pick type says `string | null`, but IndexedDB rows aren't
    // migrated — simulate the raw shape.
    const legacy = {
      ...task({ id: 't1', isCompleted: true, completedAt: iso(2026, 7, 20) }),
      archivedAt: undefined,
    } as unknown as TaskInput;
    expect(run([legacy], 1, 30)).toEqual({ toArchive: ['t1'], toDelete: [] });
  });

  // ─── Delete stage ─────────────────────────────────────────────────

  it('soft-deletes a non-recurring task archived exactly N days ago, but not at N-1', () => {
    const tasks = [
      task({ id: 'at-n', isCompleted: true, completedAt: iso(2026, 6, 1), archivedAt: iso(2026, 6, 21) }), // 30 days
      task({ id: 'at-n-minus-1', isCompleted: true, completedAt: iso(2026, 6, 1), archivedAt: iso(2026, 6, 22) }), // 29 days
    ];
    expect(run(tasks, null, 30)).toEqual({ toArchive: [], toDelete: ['at-n'] });
  });

  it('never deletes a recurring task, even when long overdue', () => {
    const tasks = [
      task({
        id: 't1',
        isCompleted: true,
        completedAt: iso(2026, 1, 1),
        archivedAt: iso(2026, 1, 2), // ~200 days ago, threshold 30
        recurrenceRule: { frequency: 'daily', interval: 1 },
      }),
    ];
    expect(run(tasks, 1, 30)).toEqual({ toArchive: [], toDelete: [] });
  });

  it('runs the deletion clock from archivedAt, not completedAt', () => {
    // Completed 100+ days ago but archived only 5 days ago: not deleted yet.
    const tasks = [
      task({
        id: 't1',
        isCompleted: true,
        completedAt: iso(2026, 4, 1),
        archivedAt: iso(2026, 7, 16),
      }),
    ];
    expect(run(tasks, 1, 30)).toEqual({ toArchive: [], toDelete: [] });
  });

  it('runs the stages independently: deletion works with archiving off, and vice versa', () => {
    const archived = task({
      id: 'archived',
      isCompleted: true,
      completedAt: iso(2026, 6, 1),
      archivedAt: iso(2026, 6, 1), // 50 days ago
    });
    const completed = task({ id: 'completed', isCompleted: true, completedAt: iso(2026, 7, 19) });
    expect(run([archived, completed], null, 30)).toEqual({ toArchive: [], toDelete: ['archived'] });
    expect(run([archived, completed], 1, null)).toEqual({ toArchive: ['completed'], toDelete: [] });
  });

  it('returns all-empty for an empty task list', () => {
    expect(run([], 1, 30)).toEqual({ toArchive: [], toDelete: [] });
  });
});
