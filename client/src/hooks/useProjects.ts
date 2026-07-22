import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { Project } from '@shared/types';

export function useProjects() {
  const projects = useLiveQuery(
    () =>
      db.projects
        .filter((p) => !p.deletedAt)
        .toArray()
        .then((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder)),
    [],
  );

  const createProject = async (data: { name: string; color: string; icon?: string; description?: string; folderId?: string | null; linkedActivityId?: string | null }) => {
    const now = new Date().toISOString();
    const all = await db.projects.filter((p) => !p.deletedAt).toArray();
    const project: Project = {
      id: generateId(),
      name: data.name,
      description: data.description ?? '',
      color: data.color,
      icon: data.icon ?? '',
      sortOrder: all.length,
      isArchived: false,
      folderId: data.folderId ?? null,
      linkedActivityId: data.linkedActivityId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.projects.add(project);
    return project;
  };

  const moveProject = async (id: string, folderId: string | null) => {
    await db.projects.update(id, {
      folderId,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateProject = async (
    id: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'color' | 'icon' | 'isArchived' | 'folderId' | 'linkedActivityId'>>,
  ) => {
    await db.projects.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteProject = async (id: string) => {
    const now = new Date().toISOString();
    await db.transaction('rw', [db.projects, db.projectTasks, db.todayTasks], async () => {
      await db.projects.update(id, { deletedAt: now, updatedAt: now });
      // Cascade soft-delete tasks
      const tasks = await db.projectTasks.where('projectId').equals(id).toArray();
      for (const task of tasks) {
        if (!task.deletedAt) {
          await db.projectTasks.update(task.id, { deletedAt: now, updatedAt: now });
        }
      }
      // Also remove from today
      const todayTasks = await db.todayTasks.where('projectId').equals(id).toArray();
      for (const tt of todayTasks) {
        if (!tt.deletedAt) {
          await db.todayTasks.update(tt.id, { deletedAt: now, updatedAt: now });
        }
      }
    });
  };

  const reorderProjects = async (orderedIds: string[]) => {
    const now = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.projects.update(orderedIds[i], { sortOrder: i, updatedAt: now });
    }
  };

  return {
    projects: projects ?? [],
    createProject,
    updateProject,
    deleteProject,
    moveProject,
    reorderProjects,
  };
}
