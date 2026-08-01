import type { ProjectTask } from '@shared/types';
import { daysBetween, getLogicalDate } from '../utils/time';

export interface CleanupParams {
  /** Current logical date (`getLogicalDate(dayStartHour)`), as YYYY-MM-DD. */
  today: string;
  /** `settings.dayStartHour` — needed to place `completedAt`/`archivedAt` timestamps on their logical day. */
  dayStartHour: number;
  /** Age (logical days) at which a completed task is archived; `0` = the day it was completed. `null` = archiving off. */
  archiveCompletedAfterDays: number | null;
  /** Age (logical days, counted from `archivedAt`) at which an archived task is soft-deleted. `null` = deletion off. */
  deleteArchivedAfterDays: number | null;
  /**
   * Active (non-deleted) tasks only — callers filter `!deletedAt` before
   * calling, same contract as `computeRollover`. `archivedAt` may still be
   * `undefined` (not just `null`) at runtime on rows created before the
   * archive feature existed, so this function only ever tests it for
   * truthiness.
   */
  tasks: Array<
    Pick<
      ProjectTask,
      'id' | 'isCompleted' | 'completedAt' | 'updatedAt' | 'archivedAt' | 'recurrenceRule'
    >
  >;
}

export interface CleanupResult {
  /** Task ids to stamp `archivedAt` on (completed long enough ago, not yet archived). */
  toArchive: string[];
  /** Task ids to soft-delete (archived long enough ago, never recurring). */
  toDelete: string[];
}

/**
 * Decides which completed tasks move down the two-stage cleanup pipeline:
 * completed → archived (hidden from working views) → soft-deleted. Pure and
 * side-effect-free, modeled on `computeRollover` — the caller owns turning
 * this into Dexie writes.
 *
 * Rules:
 *  1. Archive: `isCompleted`, not yet archived, and the task's completion day
 *     — `getLogicalDate(dayStartHour, completedAt)` — is at least
 *     `archiveCompletedAfterDays` logical days before `today`. At `0` a task
 *     archives the same logical day it was completed. `completedAt` falls
 *     back to `updatedAt` for legacy/vault rows that carry
 *     `isCompleted: true` with a null `completedAt` — the last touch is the
 *     best remaining signal for when completion happened.
 *  2. Delete: already archived, non-recurring, and the archival day —
 *     `getLogicalDate(dayStartHour, archivedAt)` — is at least
 *     `deleteArchivedAfterDays` logical days before `today`. The clock runs
 *     from `archivedAt`, never `completedAt`.
 *  3. Recurring tasks (`recurrenceRule` set) are NEVER auto-deleted: the
 *     recurrence catch-up scan (`useRecurringTaskCheck`) must keep seeing the
 *     completed occurrence to know a next one is due, and a cross-device race
 *     (one device deletes while another hasn't spawned yet) could otherwise
 *     kill the chain. The strict `=== null` check means an ancient row whose
 *     `recurrenceRule` is `undefined` is also never auto-deleted — deletion
 *     deliberately errs toward keeping.
 *  4. A `null` threshold disables its stage independently of the other.
 *  5. The two lists are disjoint by construction: delete requires
 *     `archivedAt` already set (by a previous sweep), and archive requires it
 *     absent.
 */
export function computeCleanup(params: CleanupParams): CleanupResult {
  const { today, dayStartHour, archiveCompletedAfterDays, deleteArchivedAfterDays, tasks } =
    params;

  const result: CleanupResult = { toArchive: [], toDelete: [] };

  for (const task of tasks) {
    if (task.archivedAt) {
      if (
        deleteArchivedAfterDays !== null &&
        task.recurrenceRule === null &&
        daysBetween(getLogicalDate(dayStartHour, new Date(task.archivedAt)), today) >=
          deleteArchivedAfterDays
      ) {
        result.toDelete.push(task.id);
      }
    } else if (task.isCompleted && archiveCompletedAfterDays !== null) {
      const completedDay = getLogicalDate(
        dayStartHour,
        new Date(task.completedAt ?? task.updatedAt),
      );
      if (daysBetween(completedDay, today) >= archiveCompletedAfterDays) {
        result.toArchive.push(task.id);
      }
    }
  }

  return result;
}
