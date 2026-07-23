import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { isActive, notDeleted, updateRecord } from '../db/repository';
import { countActiveInBox, toggleProjectTask } from '../db/taskOps';
import type { ProjectTask, TimeBox } from '@shared/types';

/** A box task joined with the project fields the box views render inline. */
export interface EnrichedBoxTask extends ProjectTask {
  projectName: string;
  projectColor: string;
}

/**
 * Live query + mutations for one time-box ('today' | 'week' | 'later').
 *
 * This hook is the box views' data source: `/today`, and (from 5.10) the
 * `/tasks` box tabs. 'today' membership is just the `timeBox` field on the
 * task — unlike the old `TodayTask` table, nothing here is date-scoped;
 * `useTaskRollover` is what moves tasks in and out of 'today' as the
 * logical day changes.
 */
export function useTaskBox(box: TimeBox) {
  const tasks = useLiveQuery(async () => {
    const rows = notDeleted(await db.projectTasks.where('timeBox').equals(box).toArray());
    const enriched: EnrichedBoxTask[] = [];
    for (const task of rows) {
      const project = await db.projects.get(task.projectId);
      if (project && isActive(project)) {
        enriched.push({ ...task, projectName: project.name, projectColor: project.color });
      }
    }
    return enriched.sort((a, b) => a.timeBoxOrder - b.timeBoxOrder);
  }, [box]);

  /**
   * Moves `taskId` into `target`, appending it to the end of that box's
   * manual order. Moving INTO 'today' clears `scheduledDate` — a manual
   * promote consumes the pin, same reasoning as rollover's auto-promote
   * (see `computeRollover`): leaving the pin set would just re-fire on the
   * next rollover even though the user already acted on it.
   */
  const moveToBox = async (taskId: string, target: TimeBox) => {
    const timeBoxOrder = await countActiveInBox(target);
    await updateRecord(db.projectTasks, taskId, {
      timeBox: target,
      timeBoxOrder,
      ...(target === 'today' ? { scheduledDate: null } : {}),
    });
  };

  /** Rewrites `timeBoxOrder` sequentially to match `orderedIds` — mirrors `useProjectTasks.reorderTasks`. */
  const reorderBox = async (orderedIds: string[]) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await updateRecord(db.projectTasks, orderedIds[i], { timeBoxOrder: i });
    }
  };

  // Completion flip + recurrence-spawn gating live in toggleProjectTask so
  // every box consumer gets the same semantics instead of reimplementing them
  // (same reasoning as useProjectTasks.toggleTask).
  return { tasks: tasks ?? [], moveToBox, reorderBox, toggleComplete: toggleProjectTask };
}
