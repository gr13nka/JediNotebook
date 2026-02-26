import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { ProjectFolder } from '@shared/types';
import { ACTIVITY_COLORS } from '@shared/constants';

export function useFolders() {
  const folders = useLiveQuery(
    () => db.projectFolders
      .filter(f => !f.deletedAt)
      .toArray()
      .then(arr => arr.sort((a, b) => a.sortOrder - b.sortOrder)),
    [],
  );

  const createFolder = async (name: string, color?: string, parentFolderId: string | null = null) => {
    const now = new Date().toISOString();
    const all = await db.projectFolders.filter(f => !f.deletedAt).toArray();
    const folder: ProjectFolder = {
      id: generateId(),
      name,
      color: color || ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)],
      sortOrder: all.length,
      parentFolderId,
      isExpanded: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.projectFolders.add(folder);
    return folder;
  };

  const updateFolder = async (id: string, patch: Partial<Pick<ProjectFolder, 'name' | 'color' | 'isExpanded'>>) => {
    await db.projectFolders.update(id, { ...patch, updatedAt: new Date().toISOString() });
  };

  const toggleExpanded = async (id: string) => {
    const folder = await db.projectFolders.get(id);
    if (folder) {
      await db.projectFolders.update(id, { isExpanded: !folder.isExpanded, updatedAt: new Date().toISOString() });
    }
  };

  const deleteFolder = async (id: string) => {
    const now = new Date().toISOString();
    await db.projectFolders.update(id, { deletedAt: now, updatedAt: now });
    // Move child projects to root
    const childProjects = await db.projects.where('folderId').equals(id).toArray();
    for (const p of childProjects) {
      await db.projects.update(p.id, { folderId: null, updatedAt: now });
    }
  };

  return { folders: folders ?? [], createFolder, updateFolder, deleteFolder, toggleExpanded };
}
