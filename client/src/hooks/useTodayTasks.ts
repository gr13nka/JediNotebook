import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { TodayTask } from '@shared/types';
import { awardXP, XP_VALUES } from '../utils/streak';

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface EnrichedTodayTask extends TodayTask {
  taskTitle: string;
  projectName: string;
  projectColor: string;
  projectIcon: string;
  linkedActivityId: string | null;
}

export function useTodayTasks() {
  const date = getTodayDate();

  const enrichedTasks = useLiveQuery(
    async () => {
      const todayTasks = await db.todayTasks
        .where('date')
        .equals(date)
        .filter((t) => !t.deletedAt)
        .toArray();

      const enriched: EnrichedTodayTask[] = [];
      for (const tt of todayTasks) {
        const projectTask = await db.projectTasks.get(tt.projectTaskId);
        const project = await db.projects.get(tt.projectId);
        if (projectTask && !projectTask.deletedAt && project && !project.deletedAt) {
          enriched.push({
            ...tt,
            taskTitle: projectTask.title,
            projectName: project.name,
            projectColor: project.color,
            projectIcon: (project as any).icon ?? '',
            linkedActivityId: (project as any).linkedActivityId ?? null,
          });
        }
      }
      return enriched.sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [date],
  );

  const addToToday = async (projectTaskId: string, projectId: string) => {
    const existing = await db.todayTasks
      .where('date')
      .equals(date)
      .filter((t) => !t.deletedAt && t.projectTaskId === projectTaskId)
      .first();
    if (existing) return null;

    const now = new Date().toISOString();
    const all = await db.todayTasks
      .where('date')
      .equals(date)
      .filter((t) => !t.deletedAt)
      .toArray();
    const task: TodayTask = {
      id: generateId(),
      projectTaskId,
      projectId,
      sortOrder: all.length,
      isCompleted: false,
      completedAt: null,
      date,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.todayTasks.add(task);
    return task;
  };

  const removeFromToday = async (id: string) => {
    const now = new Date().toISOString();
    await db.todayTasks.update(id, { deletedAt: now, updatedAt: now });
  };

  const completeTask = async (id: string) => {
    const tt = await db.todayTasks.get(id);
    if (!tt) return;
    const now = new Date().toISOString();
    const newCompleted = !tt.isCompleted;
    await db.todayTasks.update(id, {
      isCompleted: newCompleted,
      completedAt: newCompleted ? now : null,
      updatedAt: now,
    });
    if (newCompleted) awardXP(XP_VALUES.completeTask);
    // Sync to underlying ProjectTask
    await db.projectTasks.update(tt.projectTaskId, {
      isCompleted: newCompleted,
      completedAt: newCompleted ? now : null,
      updatedAt: now,
    });
  };

  const toggleToday = async (projectTaskId: string, projectId: string) => {
    const existing = await db.todayTasks
      .where('date')
      .equals(date)
      .filter((t) => !t.deletedAt && t.projectTaskId === projectTaskId)
      .first();
    if (existing) {
      const now = new Date().toISOString();
      await db.todayTasks.update(existing.id, { deletedAt: now, updatedAt: now });
    } else {
      await addToToday(projectTaskId, projectId);
    }
  };

  const reorderTodayTasks = async (orderedIds: string[]) => {
    const now = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.todayTasks.update(orderedIds[i], { sortOrder: i, updatedAt: now });
    }
  };

  const updateTaskTitle = async (todayTaskId: string, newTitle: string) => {
    const tt = await db.todayTasks.get(todayTaskId);
    if (!tt) return;
    const now = new Date().toISOString();
    await db.projectTasks.update(tt.projectTaskId, {
      title: newTitle,
      updatedAt: now,
    });
  };

  return {
    todayTasks: enrichedTasks ?? [],
    addToToday,
    removeFromToday,
    toggleToday,
    completeTask,
    reorderTodayTasks,
    updateTaskTitle,
    date,
  };
}
