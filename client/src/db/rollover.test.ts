import { describe, it, expect } from 'vitest';
import { computeRollover } from './rollover';
import type { ProjectTask } from '@shared/types';

const TODAY = '2026-07-21';

type TaskInput = Pick<ProjectTask, 'id' | 'timeBox' | 'isCompleted' | 'scheduledDate'>;

function task(overrides: Partial<TaskInput> & { id: string }): TaskInput {
  return {
    timeBox: 'later',
    isCompleted: false,
    scheduledDate: null,
    ...overrides,
  };
}

describe('computeRollover', () => {
  it('is a same-day no-op: lastRolloverDate === today returns everything empty', () => {
    const tasks = [
      task({ id: 't1', timeBox: 'today', isCompleted: false }),
      task({ id: 't2', timeBox: 'later', isCompleted: false, scheduledDate: '2026-07-20' }),
    ];
    const result = computeRollover({ today: TODAY, lastRolloverDate: TODAY, tasks });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: [] });
  });

  it('demotes an incomplete today task to week', () => {
    const tasks = [task({ id: 't1', timeBox: 'today', isCompleted: false })];
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks });
    expect(result).toEqual({ toWeek: ['t1'], toLater: [], toToday: [] });
  });

  it('demotes a completed today task to later', () => {
    const tasks = [task({ id: 't1', timeBox: 'today', isCompleted: true })];
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks });
    expect(result).toEqual({ toWeek: [], toLater: ['t1'], toToday: [] });
  });

  it('promotes a task with a due scheduledDate to today', () => {
    // Applying this move must also clear `scheduledDate` (documented on
    // computeRollover) — without the clear, the task would still read
    // `scheduledDate <= today` on the *next* rollover, get demoted out of
    // 'today' by the demote rule, and immediately re-promoted forever.
    // computeRollover only reports the move; the clear itself is the
    // caller's (useTaskRollover's) job when it applies this result.
    const tasks = [
      task({ id: 't1', timeBox: 'later', isCompleted: false, scheduledDate: '2026-07-21' }),
    ];
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: ['t1'] });
  });

  it('nets a both-eligible task (in today + due scheduledDate) into toToday, not toWeek', () => {
    const tasks = [
      task({ id: 't1', timeBox: 'today', isCompleted: false, scheduledDate: '2026-07-21' }),
    ];
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: ['t1'] });
  });

  it('promotes a scheduledDate from several days ago (missed pin, multi-day gap)', () => {
    const tasks = [
      task({ id: 't1', timeBox: 'week', isCompleted: false, scheduledDate: '2026-07-15' }),
    ];
    // App was closed for days — lastRolloverDate is stale, but the `<=`
    // comparison still catches the overdue pin on the next run.
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-14', tasks });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: ['t1'] });
  });

  it('does not promote a scheduledDate in the future', () => {
    const tasks = [
      task({ id: 't1', timeBox: 'later', isCompleted: false, scheduledDate: '2026-07-22' }),
    ];
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: [] });
  });

  it('does not promote a completed task even with a due scheduledDate', () => {
    const tasks = [
      task({ id: 't1', timeBox: 'later', isCompleted: true, scheduledDate: '2026-07-21' }),
    ];
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: [] });
  });

  it('returns all-empty for an empty task list', () => {
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks: [] });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: [] });
  });

  it('treats a null lastRolloverDate (first run after migration) as a normal rollover day', () => {
    const tasks = [
      task({ id: 't1', timeBox: 'today', isCompleted: false }),
      task({ id: 't2', timeBox: 'today', isCompleted: true }),
      task({ id: 't3', timeBox: 'later', isCompleted: false, scheduledDate: '2026-07-21' }),
    ];
    const result = computeRollover({ today: TODAY, lastRolloverDate: null, tasks });
    expect(result).toEqual({ toWeek: ['t1'], toLater: ['t2'], toToday: ['t3'] });
  });

  it('leaves tasks with no eligible rule untouched', () => {
    const tasks = [
      task({ id: 't1', timeBox: 'week', isCompleted: false }),
      task({ id: 't2', timeBox: 'later', isCompleted: true }),
    ];
    const result = computeRollover({ today: TODAY, lastRolloverDate: '2026-07-20', tasks });
    expect(result).toEqual({ toWeek: [], toLater: [], toToday: [] });
  });
});
