import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { notDeleted, updateRecord } from '../db/repository';
import { createProjectTask, deleteProjectTaskCascade, toggleProjectTask } from '../db/taskOps';
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

  const createTask = (title: string, recurrenceRule?: RecurrenceRule | null) => {
    if (!projectId) return Promise.resolve(null);
    return createProjectTask(projectId, title, recurrenceRule);
  };

  const updateTask = (id: string, patch: Partial<Pick<ProjectTask, 'title'>>) =>
    updateRecord(db.projectTasks, id, patch);

  // Completion flip + recurrence-spawn gating live in toggleProjectTask so
  // every caller outside this scoped hook (e.g. Task Selection's cross-project
  // rows) gets the same semantics instead of reimplementing them.
  const toggleTask = (id: string) => toggleProjectTask(id);

  const updateRecurrence = (id: string, recurrenceRule: RecurrenceRule | null) =>
    updateRecord(db.projectTasks, id, { recurrenceRule });

  // Cascade: soft-delete the task, then any today-tasks pointing at it.
  const deleteTask = (id: string) => deleteProjectTaskCascade(id);

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
