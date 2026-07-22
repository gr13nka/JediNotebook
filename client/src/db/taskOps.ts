import { db } from './index';
import { newRecord, notDeleted, softDelete, updateRecord } from './repository';
import { getLogicalDate } from '../utils/time';
import { shouldCreateRecurrence } from '../utils/recurrence';
import type { ProjectTask, RecurrenceRule, TimeBox } from '@shared/types';

/**
 * ProjectTask writes that need to live outside a single project's context.
 * `createProjectTask`/`deleteProjectTaskCascade`: Inbox sorting and the
 * cross-project Task Selection view both create/delete tasks in whichever
 * project the user picks, so they can't scope a `useProjectTasks(projectId)`
 * hook (that would mean instantiating one per task in a loop).
 * `spawnNextOccurrence`: shared by the two independent places a recurring
 * task can be marked complete (see its own doc comment). `toggleProjectTask`:
 * shared by every place a task's completion is flipped outside a scoped
 * `useProjectTasks` — same cross-project constraint as create/delete above.
 * `useProjectTasks` calls all four, so each rule (append-sortOrder,
 * delete-cascade, spawn gating, completion flip) lives in exactly one place.
 */

/**
 * Count of active (non-deleted) tasks currently in `timeBox`, across all
 * projects — `timeBox` isn't indexed yet (Dexie schema bump lands later), so
 * this is a full-table filter, same pattern as `seed.ts`'s `isBreak` lookup.
 */
async function countActiveInBox(timeBox: TimeBox): Promise<number> {
  return db.projectTasks.filter((t) => !t.deletedAt && t.timeBox === timeBox).count();
}

/**
 * Appends a new task to `projectId`'s active task list (sortOrder = current
 * active count) and to the end of the `'later'` box (every new task starts
 * unboxed in `'later'`; `timeBoxOrder` = current active count in that box).
 */
export async function createProjectTask(
  projectId: string,
  title: string,
  recurrenceRule?: RecurrenceRule | null,
): Promise<ProjectTask> {
  const all = notDeleted(await db.projectTasks.where('projectId').equals(projectId).toArray());
  const timeBoxOrder = await countActiveInBox('later');
  const task = newRecord({
    projectId,
    title,
    sortOrder: all.length,
    isCompleted: false,
    completedAt: null,
    recurrenceRule: recurrenceRule ?? null,
    lastRecurredDate: null,
    timeBox: 'later' as TimeBox,
    scheduledDate: null,
    timeBoxOrder,
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
 *
 * The spawned occurrence inherits the completed task's `timeBox` (a
 * recurring task keeps recurring into whichever box its owner is using it
 * from) with a fresh, unpinned `scheduledDate` and a `timeBoxOrder`
 * appended to that box.
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
  const timeBoxOrder = await countActiveInBox(task.timeBox);
  await db.projectTasks.add(newRecord({
    projectId: task.projectId,
    title: task.title,
    sortOrder: all.length,
    isCompleted: false,
    completedAt: null,
    recurrenceRule: task.recurrenceRule,
    lastRecurredDate: today,
    timeBox: task.timeBox,
    scheduledDate: null,
    timeBoxOrder,
  }));

  await updateRecord(db.projectTasks, task.id, { lastRecurredDate: today });
}

/**
 * Flips a task's completion, stamping/clearing `completedAt`, then spawns its
 * next recurrence if completing it made one due (see `spawnNextOccurrence`).
 * No-ops if the task doesn't exist (already deleted underneath the caller).
 */
export async function toggleProjectTask(taskId: string): Promise<void> {
  const task = await db.projectTasks.get(taskId);
  if (!task) return;
  const now = new Date().toISOString();
  const newCompleted = !task.isCompleted;
  await db.projectTasks.update(taskId, {
    isCompleted: newCompleted,
    completedAt: newCompleted ? now : null,
    updatedAt: now,
  });
  // `task` is the pre-toggle snapshot; only its recurrence-related fields are
  // read, so it's still valid after the write above.
  if (newCompleted && task.recurrenceRule) {
    await spawnNextOccurrence(task);
  }
}
