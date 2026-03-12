import { useEffect } from 'react';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import { shouldCreateRecurrence } from '../utils/recurrence';

export function useRecurringTaskCheck() {
  useEffect(() => {
    const checkRecurring = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const tasks = await db.projectTasks
        .filter(t => !t.deletedAt && t.isCompleted && t.recurrenceRule !== null)
        .toArray();

      for (const task of tasks) {
        if (!task.recurrenceRule) continue;
        if (!shouldCreateRecurrence(task.lastRecurredDate, task.recurrenceRule, today)) continue;

        // Check if there's already a pending (incomplete) task with same title in same project
        const existing = await db.projectTasks
          .where('projectId').equals(task.projectId)
          .filter(t => !t.deletedAt && !t.isCompleted && t.title === task.title)
          .first();
        if (existing) continue;

        const now = new Date().toISOString();
        const all = await db.projectTasks
          .where('projectId').equals(task.projectId)
          .filter(t => !t.deletedAt)
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

        // Update the original task's lastRecurredDate
        await db.projectTasks.update(task.id, { lastRecurredDate: today, updatedAt: now });
      }
    };
    checkRecurring();

    // Re-check when app resumes (e.g., after overnight sleep)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkRecurring();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
}
