import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Project, ProjectTask, ProjectFolder } from '@shared/types';

export interface TaskGroup {
  project: Project;
  tasks: ProjectTask[];
}

export interface FolderGroup {
  folder: ProjectFolder | null;
  projects: TaskGroup[];
}

export function useAllProjectTasks() {
  const groups = useLiveQuery(async () => {
    const projects = await db.projects
      .filter((p) => !p.deletedAt && !p.isArchived)
      .toArray();
    projects.sort((a, b) => a.sortOrder - b.sortOrder);

    const result: TaskGroup[] = [];
    for (const project of projects) {
      const tasks = await db.projectTasks
        .where('projectId')
        .equals(project.id)
        .filter((t) => !t.deletedAt && !t.isCompleted)
        .toArray();
      tasks.sort((a, b) => a.sortOrder - b.sortOrder);
      if (tasks.length > 0) {
        result.push({ project, tasks });
      }
    }
    return result;
  }, []);

  const folderGroups = useLiveQuery(async () => {
    const folders = await db.projectFolders
      .filter((f) => !f.deletedAt)
      .toArray();
    folders.sort((a, b) => a.sortOrder - b.sortOrder);

    const projects = await db.projects
      .filter((p) => !p.deletedAt && !p.isArchived)
      .toArray();
    projects.sort((a, b) => a.sortOrder - b.sortOrder);

    const projectGroups: TaskGroup[] = [];
    for (const project of projects) {
      const tasks = await db.projectTasks
        .where('projectId')
        .equals(project.id)
        .filter((t) => !t.deletedAt && !t.isCompleted)
        .toArray();
      tasks.sort((a, b) => a.sortOrder - b.sortOrder);
      if (tasks.length > 0) {
        projectGroups.push({ project, tasks });
      }
    }

    const folderMap = new Map<string | null, TaskGroup[]>();
    for (const group of projectGroups) {
      const folderId = group.project.folderId ?? null;
      if (!folderMap.has(folderId)) {
        folderMap.set(folderId, []);
      }
      folderMap.get(folderId)!.push(group);
    }

    const result: FolderGroup[] = [];
    for (const folder of folders) {
      const folderProjects = folderMap.get(folder.id);
      if (folderProjects && folderProjects.length > 0) {
        result.push({ folder, projects: folderProjects });
      }
    }

    const unfiledProjects = folderMap.get(null);
    if (unfiledProjects && unfiledProjects.length > 0) {
      result.push({ folder: null, projects: unfiledProjects });
    }

    return result;
  }, []);

  return { groups: groups ?? [], folderGroups: folderGroups ?? [] };
}
