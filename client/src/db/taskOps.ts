import { db } from './index';
import { newRecord, notDeleted, softDelete } from './repository';
import type { ProjectTask, RecurrenceRule } from '@shared/types';

/**
 * The two ProjectTask writes that need to happen from outside a single
 * project's context — Inbox sorting and the cross-project Task Selection
 * view both create/delete tasks in whichever project the user picks, so
 * they can't scope a `useProjectTasks(projectId)` hook (that would mean
 * instantiating one per task in a loop). `useProjectTasks` itself also
 * calls these, so the append-sortOrder and delete-cascade rules live in
 * exactly one place.
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
