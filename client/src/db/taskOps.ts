import { db } from './index';
import { newRecord, notDeleted, softDelete, updateRecord } from './repository';
import { getLogicalDate } from '../utils/time';
import { shouldCreateRecurrence } from '../utils/recurrence';
import type { ProjectTask, RecurrenceRule } from '@shared/types';

/**
 * ProjectTask writes that need to live outside a single project's context.
 * `createProjectTask`/`deleteProjectTaskCascade`: Inbox sorting and the
 * cross-project Task Selection view both create/delete tasks in whichever
 * project the user picks, so they can't scope a `useProjectTasks(projectId)`
 * hook (that would mean instantiating one per task in a loop).
 * `spawnNextOccurrence`: shared by the two independent places a recurring
 * task can be marked complete (see its own doc comment). `useProjectTasks`
 * calls all three, so each rule (append-sortOrder, delete-cascade, spawn
 * gating) lives in exactly one place.
 */

/** Appends a new task to `projectId`'s active task list (sortOrder = current active count). */
export async function createProjectTask(
  projectId: string,
  title: string,
  recurrenceRule?: RecurrenceRule | null,
): Promise<ProjectTask> {
  const all = notDeleted(await db.projectTasks.where('projectId').equals(projectId).toArray());
  const task = newRecord({
    projectId,
    title,
    sortOrder: all.length,
    isCompleted: false,
    completedAt: null,
    recurrenceRule: recurrenceRule ?? null,
    lastRecurredDate: null,
  });
  await db.projectTasks.add(task);
  return task;
}

/** Soft-deletes a task and every today-task pointing at it, atomically. */
export async function deleteProjectTaskCascade(taskId: string): Promise<void> {
  await db.transaction('rw', [db.projectTasks, db.todayTasks], async () => {
    await softDelete(db.projectTasks, taskId);
    const todayTasks = await db.todayTasks
      .where('projectTaskId')
      .equals(taskId)
      .filter((t) => !t.deletedAt)
      .toArray();
    for (const tt of todayTasks) {
      await softDelete(db.todayTasks, tt.id);
    }
  });
}

/**
 * Spawns the next occurrence of a completed recurring task, if one is due.
 *
 * Single implementation shared by the two independent triggers that can
 * complete a recurring task: `useProjectTasks.toggleTask` (interactive —
 * fires the moment the user checks it off) and `useRecurringTaskCheck` (a
 * periodic scan that catches tasks completed while the app wasn't running,
 * e.g. across an overnight sleep). Both call this instead of duplicating
 * the spawn logic. `task` only needs to be completed and carry a
 * `recurrenceRule` — its `isCompleted`/`completedAt` fields aren't read
 * here, so a pre-toggle snapshot is fine.
 *
 * No-ops (creates nothing, touches no `lastRecurredDate`) unless BOTH gates
 * pass:
 *  - `shouldCreateRecurrence`: is the next occurrence due on/before today?
 *    Recurrence is a calendar concept ("every Monday"), not the app's
 *    day-start-adjusted concept of "today" — so `today` here is the local
 *    calendar date via `getLogicalDate(0)` (dayStartHour 0 never
 *    decrements the date), independent of the user's `dayStartHour`
 *    setting.
 *  - title dedup: is there already an incomplete task with the same title
 *    in the same project? A secondary guard against double-spawns (e.g.
 *    both triggers racing), kept even though the due-date gate above now
 *    does most of the work.
 *
 * On success, stamps `lastRecurredDate` on BOTH the new task and the
 * original — the original's stamp is what the next call's
 * `shouldCreateRecurrence` check reads.
 */
export async function spawnNextOccurrence(task: ProjectTask): Promise<void> {
  if (!task.recurrenceRule) return;
  const today = getLogicalDate(0);
  if (!shouldCreateRecurrence(task.lastRecurredDate, task.recurrenceRule, today)) return;

  const existingIncomplete = await db.projectTasks
    .where('projectId')
    .equals(task.projectId)
    .filter((t) => !t.deletedAt && !t.isCompleted && t.title === task.title)
    .first();
  if (existingIncomplete) return;

  const all = notDeleted(
    await db.projectTasks.where('projectId').equals(task.projectId).toArray(),
  );
  await db.projectTasks.add(newRecord({
    projectId: task.projectId,
    title: task.title,
    sortOrder: all.length,
    isCompleted: false,
    completedAt: null,
    recurrenceRule: task.recurrenceRule,
    lastRecurredDate: today,
  }));

  await updateRecord(db.projectTasks, task.id, { lastRecurredDate: today });
}
