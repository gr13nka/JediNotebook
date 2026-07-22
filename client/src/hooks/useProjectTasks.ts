import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { newRecord, notDeleted, softDelete, updateRecord } from '../db/repository';
import type { ProjectTask, RecurrenceRule } from '@shared/types';

// Per-project query with recurrence-spawn logic on completion — doesn't fit
// useEntity's flat-table shape, so this stays bespoke on top of the
// repository primitives.
export function useProjectTasks(projectId: string | null) {
  const tasks = useLiveQuery(
    () => {
      if (!projectId) return Promise.resolve([] as ProjectTask[]);
      return db.projectTasks
        .where('projectId')
        .equals(projectId)
        .toArray()
        .then((arr) => notDeleted(arr).sort((a, b) => a.sortOrder - b.sortOrder));
    },
    [projectId],
  );

  const createTask = async (title: string, recurrenceRule?: RecurrenceRule | null) => {
    if (!projectId) return null;
    const all = notDeleted(
      await db.projectTasks.where('projectId').equals(projectId).toArray(),
    );
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
  };

  const updateTask = (id: string, patch: Partial<Pick<ProjectTask, 'title'>>) =>
    updateRecord(db.projectTasks, id, patch);

  const toggleTask = async (id: string) => {
    const task = await db.projectTasks.get(id);
    if (!task) return;
    const now = new Date().toISOString();
    const newCompleted = !task.isCompleted;
    await db.projectTasks.update(id, {
      isCompleted: newCompleted,
      completedAt: newCompleted ? now : null,
      updatedAt: now,
    });
    // If completing a recurring task, auto-create next occurrence
    if (newCompleted && task.recurrenceRule) {
      // Dedup guard: don't create if an incomplete task with same title already exists
      const existingIncomplete = await db.projectTasks
        .where('projectId')
        .equals(task.projectId)
        .filter((t) => !t.deletedAt && !t.isCompleted && t.title === task.title)
        .first();
      if (existingIncomplete) return;

      const today = now.slice(0, 10);
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
    }
  };

  const updateRecurrence = (id: string, recurrenceRule: RecurrenceRule | null) =>
    updateRecord(db.projectTasks, id, { recurrenceRule });

  // Cascade: soft-delete the task, then any today-tasks pointing at it.
  const deleteTask = async (id: string) => {
    await db.transaction('rw', [db.projectTasks, db.todayTasks], async () => {
      await softDelete(db.projectTasks, id);
      const todayTasks = await db.todayTasks
        .where('projectTaskId')
        .equals(id)
        .filter((t) => !t.deletedAt)
        .toArray();
      for (const tt of todayTasks) {
        await softDelete(db.todayTasks, tt.id);
      }
    });
  };

  const reorderTasks = async (orderedIds: string[]) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await updateRecord(db.projectTasks, orderedIds[i], { sortOrder: i });
    }
  };

  return {
    tasks: tasks ?? [],
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    reorderTasks,
    updateRecurrence,
  };
}
