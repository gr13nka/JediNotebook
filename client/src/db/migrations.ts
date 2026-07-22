import type { TimeBox } from '@shared/types';
import { getLogicalDate } from '../utils/time';

/**
 * One-shot classification used by the Dexie v10 upgrade to assign every
 * pre-existing `ProjectTask` a `timeBox` before the box views (and the daily
 * rollover) exist. No historical data distinguishes "week" intent, so
 * incomplete tasks land in either `'today'` (still on the day's picked list)
 * or `'later'` — never `'week'`. A task counts as completed "today" by the
 * logical date its `completedAt` falls on, not the wall-clock date, so it
 * agrees with `useTaskRollover()`'s later same-day/day-boundary rules.
 */
export function classifyTimeBoxForMigration(
  task: { isCompleted: boolean; completedAt: string | null },
  isInTodayList: boolean,
  today: string,
  dayStartHour: number,
): TimeBox {
  if (!task.isCompleted) {
    return isInTodayList ? 'today' : 'later';
  }
  if (task.completedAt && getLogicalDate(dayStartHour, new Date(task.completedAt)) === today) {
    return 'today';
  }
  return 'later';
}
