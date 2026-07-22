import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { isActive } from '../db/repository';
import type { Project, ProjectTask, ProjectFolder } from '@shared/types';

export interface TaskGroup {
  project: Project;
  tasks: ProjectTask[];
  completedTasks: ProjectTask[];
}

export interface FolderGroup {
  folder: ProjectFolder | null;
  projects: TaskGroup[];
}

async function buildTaskGroup(project: Project): Promise<TaskGroup> {
  const allTasks = await db.projectTasks
    .where('projectId')
    .equals(project.id)
    .filter(isActive)
    .toArray();
  const tasks = allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.sortOrder - b.sortOrder);
  const completedTasks = allTasks.filter((t) => t.isCompleted).sort((a, b) => {
    const aTime = a.completedAt ?? a.updatedAt;
    const bTime = b.completedAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
  return { project, tasks, completedTasks };
}

export function useAllProjectTasks() {
  const groups = useLiveQuery(async () => {
    const projects = await db.projects
      .filter((p) => isActive(p) && !p.isArchived)
      .toArray();
    projects.sort((a, b) => a.sortOrder - b.sortOrder);

    const result: TaskGroup[] = [];
    for (const project of projects) {
      const group = await buildTaskGroup(project);
      if (group.tasks.length > 0 || group.completedTasks.length > 0) {
        result.push(group);
      }
    }
    return result;
  }, []);

  const folderGroups = useLiveQuery(async () => {
    const folders = await db.projectFolders
      .filter(isActive)
      .toArray();
    folders.sort((a, b) => a.sortOrder - b.sortOrder);

    const projects = await db.projects
      .filter((p) => isActive(p) && !p.isArchived)
      .toArray();
    projects.sort((a, b) => a.sortOrder - b.sortOrder);

    const projectGroups: TaskGroup[] = [];
    for (const project of projects) {
      const group = await buildTaskGroup(project);
      if (group.tasks.length > 0 || group.completedTasks.length > 0) {
        projectGroups.push(group);
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
