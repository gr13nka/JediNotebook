import { useEffect } from 'react';
import { db } from '../db';
import { spawnNextOccurrence } from '../db/taskOps';

// Background counterpart to useProjectTasks.toggleTask's interactive spawn:
// catches recurring tasks that were completed while the app wasn't running
// (e.g. overnight) by re-scanning all completed recurring tasks on mount
// and whenever the tab regains visibility. Both paths share the actual
// spawn/gating logic in db/taskOps.ts's spawnNextOccurrence.
export function useRecurringTaskCheck() {
  useEffect(() => {
    const checkRecurring = async () => {
      // Deliberately does NOT filter out archived rows (`archivedAt` set):
      // the cleanup sweep auto-archives completed tasks, and this catch-up
      // scan must keep seeing archived completed recurring tasks or their
      // next occurrence would never spawn.
      const tasks = await db.projectTasks
        .filter((t) => !t.deletedAt && t.isCompleted && t.recurrenceRule !== null)
        .toArray();

      for (const task of tasks) {
        await spawnNextOccurrence(task);
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
