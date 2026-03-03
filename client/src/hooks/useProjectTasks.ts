import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { ProjectTask, RecurrenceRule } from '@shared/types';
import { awardXP, XP_VALUES } from '../utils/streak';

export function useProjectTasks(projectId: string | null) {
  const tasks = useLiveQuery(
    () => {
      if (!projectId) return Promise.resolve([] as ProjectTask[]);
      return db.projectTasks
        .where('projectId')
        .equals(projectId)
        .filter((t) => !t.deletedAt)
        .toArray()
        .then((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder));
    },
    [projectId],
  );

  const createTask = async (title: string, recurrenceRule?: RecurrenceRule | null) => {
    if (!projectId) return null;
    const now = new Date().toISOString();
    const all = await db.projectTasks
      .where('projectId')
      .equals(projectId)
      .filter((t) => !t.deletedAt)
      .toArray();
    const task: ProjectTask = {
      id: generateId(),
      projectId,
      title,
      sortOrder: all.length,
      isCompleted: false,
      completedAt: null,
      recurrenceRule: recurrenceRule ?? null,
      lastRecurredDate: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.projectTasks.add(task);
    awardXP(XP_VALUES.createTask);
    return task;
  };

  const updateTask = async (id: string, patch: Partial<Pick<ProjectTask, 'title'>>) => {
    await db.projectTasks.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

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
    if (newCompleted) awardXP(XP_VALUES.completeTask);
    // If completing a recurring task, auto-create next occurrence
    if (newCompleted && task.recurrenceRule) {
      const today = now.slice(0, 10);
      const all = await db.projectTasks
        .where('projectId')
        .equals(task.projectId)
        .filter((t) => !t.deletedAt)
        .toArray();
      await db.projectTasks.add({
        id: generateId(),
        projectId: task.projectId,
        title: task.title,
        sortOrder: all.length,
        isCompleted: false,
        completedAt: null,
        recurrenceRule: task.recurrenceRule,
        lastRecurredDate: today,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deviceId: getDeviceId(),
      });
    }
  };

  const updateRecurrence = async (id: string, recurrenceRule: RecurrenceRule | null) => {
    await db.projectTasks.update(id, {
      recurrenceRule,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteTask = async (id: string) => {
    const now = new Date().toISOString();
    await db.projectTasks.update(id, { deletedAt: now, updatedAt: now });
    // Also remove from today
    const todayTasks = await db.todayTasks
      .where('projectTaskId')
      .equals(id)
      .filter((t) => !t.deletedAt)
      .toArray();
    for (const tt of todayTasks) {
      await db.todayTasks.update(tt.id, { deletedAt: now, updatedAt: now });
    }
  };

  const reorderTasks = async (orderedIds: string[]) => {
    const now = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.projectTasks.update(orderedIds[i], { sortOrder: i, updatedAt: now });
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
