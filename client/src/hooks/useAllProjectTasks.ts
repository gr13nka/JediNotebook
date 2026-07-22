import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { isActive } from '../db/repository';
import type { Project, ProjectTask, ProjectFolder } from '@shared/types';

export interface TaskGroup {
  project: Project;
  incompleteTasks: ProjectTask[];
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
  const incompleteTasks = allTasks.filter((t) => !t.isCompleted).sort((a, b) => a.sortOrder - b.sortOrder);
  const completedTasks = allTasks.filter((t) => t.isCompleted).sort((a, b) => {
    const aTime = a.completedAt ?? a.updatedAt;
    const bTime = b.completedAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
  return { project, incompleteTasks, completedTasks };
}

/**
 * Buckets already-built project groups by folder, in folder `sortOrder`, with
 * unfiled projects (no `folderId`) trailing as a `folder: null` bucket.
 * Folders with no non-empty projects are dropped, same as `groups` drops
 * empty projects.
 */
function bucketByFolder(groups: TaskGroup[], folders: ProjectFolder[]): FolderGroup[] {
  const folderMap = new Map<string | null, TaskGroup[]>();
  for (const group of groups) {
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
}

// One query, two views of the same data: `groups` is the flat project list,
// `folderGroups` is that same list bucketed by folder. Splitting this into
// two useLiveQuery calls (as before) ran the identical project/task fetch
// twice on every change; deriving both shapes from one result halves that
// work without changing what either shape looks like.
export function useAllProjectTasks() {
  const data = useLiveQuery(async () => {
    const [projects, folders] = await Promise.all([
      db.projects.filter((p) => isActive(p) && !p.isArchived).toArray(),
      db.projectFolders.filter(isActive).toArray(),
    ]);
    projects.sort((a, b) => a.sortOrder - b.sortOrder);
    folders.sort((a, b) => a.sortOrder - b.sortOrder);

    const groups: TaskGroup[] = [];
    for (const project of projects) {
      const group = await buildTaskGroup(project);
      if (group.incompleteTasks.length > 0 || group.completedTasks.length > 0) {
        groups.push(group);
      }
    }

    return { groups, folderGroups: bucketByFolder(groups, folders) };
  }, []);

  return { groups: data?.groups ?? [], folderGroups: data?.folderGroups ?? [] };
}
