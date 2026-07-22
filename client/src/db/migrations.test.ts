import { describe, it, expect } from 'vitest';
import { classifyTimeBoxForMigration } from './migrations';

const DAY_START = 6;
const TODAY = '2026-07-21';

describe('classifyTimeBoxForMigration', () => {
  it('classifies an incomplete task on the today list as today', () => {
    const task = { isCompleted: false, completedAt: null };
    expect(classifyTimeBoxForMigration(task, true, TODAY, DAY_START)).toBe('today');
  });

  it('classifies an incomplete task not on the today list as later (no "week" intent to recover)', () => {
    const task = { isCompleted: false, completedAt: null };
    expect(classifyTimeBoxForMigration(task, false, TODAY, DAY_START)).toBe('later');
  });

  it('classifies a task completed earlier today as today', () => {
    // 2026-07-21 14:00 local — well after dayStartHour, same logical day as TODAY.
    const completedAt = new Date(2026, 6, 21, 14, 0).toISOString();
    const task = { isCompleted: true, completedAt };
    expect(classifyTimeBoxForMigration(task, false, TODAY, DAY_START)).toBe('today');
  });

  it('classifies a task completed on a past day as later', () => {
    const completedAt = new Date(2026, 6, 18, 14, 0).toISOString();
    const task = { isCompleted: true, completedAt };
    expect(classifyTimeBoxForMigration(task, false, TODAY, DAY_START)).toBe('later');
  });

  it('classifies a completed task with a null completedAt as later', () => {
    const task = { isCompleted: true, completedAt: null };
    expect(classifyTimeBoxForMigration(task, false, TODAY, DAY_START)).toBe('later');
  });

  it('respects the logical day boundary: completedAt at 01:00 with dayStartHour 6 belongs to the previous logical day', () => {
    // 2026-07-21 01:00 local is still "yesterday" (2026-07-20) per getLogicalDate
    // with dayStartHour 6 — even though isInTodayList/today both say 07-21, the
    // completion's own logical date doesn't match, so it's not "today".
    const completedAt = new Date(2026, 6, 21, 1, 0).toISOString();
    const task = { isCompleted: true, completedAt };
    expect(classifyTimeBoxForMigration(task, false, TODAY, DAY_START)).toBe('later');
  });

  it('is not fooled by isInTodayList for a completed task (only completedAt drives completed classification)', () => {
    const completedAt = new Date(2026, 6, 18, 14, 0).toISOString();
    const task = { isCompleted: true, completedAt };
    expect(classifyTimeBoxForMigration(task, true, TODAY, DAY_START)).toBe('later');
  });
});
