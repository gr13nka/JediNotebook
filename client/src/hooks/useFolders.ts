import { db } from '../db';
import { notDeleted, updateRecord } from '../db/repository';
import { useEntity } from './useEntity';
import type { ProjectFolder } from '@shared/types';
import { ACTIVITY_COLORS } from '@shared/constants';

const bySortOrder = (a: ProjectFolder, b: ProjectFolder) => a.sortOrder - b.sortOrder;

export function useFolders() {
  const { items: folders, create, update, remove } = useEntity<ProjectFolder>(db.projectFolders, {
    sort: bySortOrder,
  });

  const createFolder = async (name: string, color?: string, parentFolderId: string | null = null) => {
    const all = notDeleted(await db.projectFolders.toArray());
    return create({
      name,
      color: color || ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)],
      sortOrder: all.length,
      parentFolderId,
      isExpanded: true,
    });
  };

  const updateFolder = (id: string, patch: Partial<Pick<ProjectFolder, 'name' | 'color' | 'isExpanded'>>) =>
    update(id, patch);

  const toggleExpanded = async (id: string) => {
    const folder = await db.projectFolders.get(id);
    if (folder) {
      await update(id, { isExpanded: !folder.isExpanded });
    }
  };

  // Cascade: soft-delete the folder, then move its direct child projects to
  // root (folderId: null) rather than deleting them — folders are just an
  // organizational layer over projects.
  const deleteFolder = async (id: string) => {
    await remove(id);
    const childProjects = await db.projects.where('folderId').equals(id).toArray();
    for (const p of childProjects) {
      await updateRecord(db.projects, p.id, { folderId: null });
    }
  };

  return { folders, createFolder, updateFolder, deleteFolder, toggleExpanded };
}
