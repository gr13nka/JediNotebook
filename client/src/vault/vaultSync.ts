import { db } from '../db';
import type { VaultBackend } from './vaultBackend';
import { FileIndex } from './fileIndex';
import {
  serializeActivity, deserializeActivity,
  serializeProject, deserializeProject, deserializeTasks,
  serializeTimeLog, deserializeTimeLog,
  serializeTodayTasks, deserializeTodayTasks,
  serializeInbox, deserializeInbox,
  serializeSettings, deserializeSettings,
  serializeFolders, deserializeFolders,
} from './serializers';
import { extractShortIdFromFilename, uuidMatchesShortId } from './sanitize';
import {
  ACTIVITIES, PROJECTS, PROJECT_TASKS, TIME_LOG, TODAY, INBOX, SETTINGS, FOLDERS,
  vaultDirs, tableFromPath,
} from './vaultLayout';

const VAULT_VERSION = 1;

export const fileIndex = new FileIndex();

// ─── Export all data to disk ──────────────────────────────────────

export async function exportAllToDisk(backend: VaultBackend): Promise<void> {
  // Write vault marker
  await backend.writeFile('vault.json', JSON.stringify({
    version: VAULT_VERSION,
    exportedAt: new Date().toISOString(),
  }, null, 2) + '\n');

  // Ensure directories exist
  for (const dir of vaultDirs()) {
    await backend.mkdir(dir);
  }

  // Settings
  const settings = await db.settings.get('default');
  if (settings) {
    const { path, content } = serializeSettings(settings);
    await backend.writeFile(path, content);
  }

  // Folders
  const folders = await db.projectFolders.toArray();
  if (folders.length > 0) {
    const { path, content } = serializeFolders(folders);
    await backend.writeFile(path, content);
  }

  // Activities
  const activities = await db.activities.filter(a => !a.deletedAt).toArray();
  for (const a of activities) {
    const { path, content } = serializeActivity(a);
    await backend.writeFile(path, content);
    fileIndex.set(a.id, path);
  }

  // Projects + Tasks
  const projects = await db.projects.filter(p => !p.deletedAt).toArray();
  for (const p of projects) {
    const tasks = await db.projectTasks.where('projectId').equals(p.id).toArray();
    const files = serializeProject(p, tasks);
    for (const [path, content] of files) {
      await backend.writeFile(path, content);
    }
    // Index the project directory
    const projectPath = [...files.keys()][0]; // project.md path
    if (projectPath) fileIndex.set(p.id, projectPath);
  }

  // Inbox (single file for all items)
  const inboxItems = await db.inboxItems.filter(i => !i.deletedAt).toArray();
  if (inboxItems.length > 0) {
    const { path, content } = serializeInbox(inboxItems);
    await backend.writeFile(path, content);
  }

  // Time entries grouped by date
  const timeEntries = await db.timeEntries.filter(e => !e.deletedAt).toArray();
  const byDate = new Map<string, typeof timeEntries>();
  for (const e of timeEntries) {
    const arr = byDate.get(e.date) || [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  // Build activity name lookup
  const activityNames = new Map<string, string>();
  for (const a of activities) {
    activityNames.set(a.id, a.name);
  }
  for (const [date, entries] of byDate) {
    const { path, content } = serializeTimeLog(date, entries, activityNames);
    await backend.writeFile(path, content);
  }

  // Today tasks grouped by date
  const todayTasks = await db.todayTasks.filter(t => !t.deletedAt).toArray();
  const todayByDate = new Map<string, typeof todayTasks>();
  for (const t of todayTasks) {
    const arr = todayByDate.get(t.date) || [];
    arr.push(t);
    todayByDate.set(t.date, arr);
  }
  // Build task title lookup
  const allProjectTasks = await db.projectTasks.toArray();
  const taskTitles = new Map<string, string>();
  for (const t of allProjectTasks) {
    taskTitles.set(t.id, t.title);
  }
  for (const [date, tasks] of todayByDate) {
    const { path, content } = serializeTodayTasks(date, tasks, taskTitles);
    await backend.writeFile(path, content);
  }
}

// ─── Import all data from disk ────────────────────────────────────

export async function importAllFromDisk(backend: VaultBackend): Promise<{ total: number; counts: Record<string, number>; errors: string[] }> {
  fileIndex.clear();
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  // Helper: try exists() without aborting — returns false on error
  async function safeExists(path: string): Promise<boolean> {
    try {
      return await backend.exists(path);
    } catch (err) {
      errors.push(`exists("${path}"): ${err}`);
      return false;
    }
  }

  // Settings
  try {
    if (await safeExists(SETTINGS.path)) {
      const content = await backend.readFile(SETTINGS.path);
      const imported = deserializeSettings(content);
      const existing = await db.settings.get('default');
      if (!existing || (imported.updatedAt && imported.updatedAt > (existing.updatedAt || ''))) {
        await db.settings.put({ id: 'default', ...imported } as any);
        counts.settings = 1;
      }
    }
  } catch (err) { errors.push(`settings: ${err}`); }

  // Folders
  try {
    if (await safeExists(FOLDERS.path)) {
      const content = await backend.readFile(FOLDERS.path);
      const folders = deserializeFolders(content);
      for (const f of folders) {
        await mergeEntity(db.projectFolders, f);
      }
    }
  } catch (err) { errors.push(`folders: ${err}`); }

  // Activities
  try {
    const activityFiles = await backend.listFiles(ACTIVITIES.dir, ACTIVITIES.fileExtension);
    for (const filePath of activityFiles) {
      const content = await backend.readFile(filePath);
      const activity = deserializeActivity(content);
      await mergeEntity(db.activities, activity);
      fileIndex.set(activity.id, filePath);
    }
    counts.activities = activityFiles.length;
  } catch (err) { errors.push(`activities: ${err}`); }

  // Projects + Tasks
  try {
    let projectCount = 0;
    const projectDirs = await backend.listDirs(PROJECTS.dir);
    for (const dirPath of projectDirs) {
      const projectPath = `${dirPath}/${PROJECTS.fileName}`;
      if (!(await safeExists(projectPath))) continue;

      const projectContent = await backend.readFile(projectPath);
      const project = deserializeProject(projectContent);

      // Extract name from directory
      const dirName = dirPath.split('/').pop() || '';
      const nameMatch = dirName.match(/^(.+)\s+\([a-f0-9]{6}\)$/);
      project.name = nameMatch ? nameMatch[1] : dirName;

      await mergeEntity(db.projects, project);
      fileIndex.set(project.id, projectPath);
      projectCount++;

      // Tasks
      const tasksPath = `${dirPath}/${PROJECT_TASKS.fileName}`;
      if (await safeExists(tasksPath)) {
        const tasksContent = await backend.readFile(tasksPath);
        const tasks = deserializeTasks(tasksContent);
        for (const t of tasks) {
          await mergeEntity(db.projectTasks, t);
        }
      }
    }
    counts.projects = projectCount;
  } catch (err) { errors.push(`projects: ${err}`); }

  // Inbox
  try {
    if (await safeExists(INBOX.path)) {
      const content = await backend.readFile(INBOX.path);
      const items = deserializeInbox(content);
      for (const item of items) {
        await mergeEntity(db.inboxItems, item);
      }
    }
  } catch (err) { errors.push(`inbox: ${err}`); }

  // Time logs
  try {
    if (await safeExists(TIME_LOG.dir)) {
      const timeLogFiles = await backend.listFiles(TIME_LOG.dir, TIME_LOG.fileExtension);
      for (const filePath of timeLogFiles) {
        const content = await backend.readFile(filePath);
        const { entries } = deserializeTimeLog(content);
        for (const e of entries) {
          await mergeEntity(db.timeEntries, e);
        }
      }
    }
  } catch (err) { errors.push(`timeLogs: ${err}`); }

  // Today tasks
  try {
    if (await safeExists(TODAY.dir)) {
      const todayFiles = await backend.listFiles(TODAY.dir, TODAY.fileExtension);
      for (const filePath of todayFiles) {
        const content = await backend.readFile(filePath);
        const { tasks } = deserializeTodayTasks(content);
        for (const t of tasks) {
          await mergeEntity(db.todayTasks, t);
        }
      }
      counts.todayTasks = todayFiles.length;
    }
  } catch (err) { errors.push(`todayTasks: ${err}`); }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (errors.length > 0) {
    console.error('[vault] Import errors:', errors);
  }
  console.log('[vault] Import complete:', counts, `(${total} total)`);
  // If we had errors and imported nothing, something is fundamentally wrong — surface it
  if (total === 0 && errors.length > 0) {
    throw new Error(`Vault import failed: ${errors.slice(0, 3).join('; ')}`);
  }
  return { total, counts, errors };
}

// ─── LWW Merge ────────────────────────────────────────────────────

async function mergeEntity(
  table: any,
  incoming: any,
): Promise<void> {
  const existing = await table.get(incoming.id);
  if (!existing) {
    // New entity — insert with null deletedAt
    await table.put({ ...incoming, deletedAt: null });
    return;
  }
  // LWW by updatedAt
  if (incoming.updatedAt > (existing.updatedAt || '')) {
    await table.put({ ...incoming, deletedAt: existing.deletedAt });
  }
}

// ─── Single entity write (for live sync) ──────────────────────────

export async function writeEntityToDisk(
  backend: VaultBackend,
  entityType: string,
  entityId: string,
): Promise<void> {
  switch (entityType) {
    case 'activities': {
      const a = await db.activities.get(entityId);
      if (!a || a.deletedAt) {
        await deleteEntityFile(backend, entityId);
        return;
      }
      const { path, content } = serializeActivity(a);
      const oldPath = fileIndex.getPath(a.id);
      if (oldPath && oldPath !== path) await backend.deleteFile(oldPath);
      await backend.writeFile(path, content);
      fileIndex.set(a.id, path);
      break;
    }
    case 'projects': {
      const p = await db.projects.get(entityId);
      if (!p || p.deletedAt) {
        await deleteEntityFile(backend, entityId);
        return;
      }
      const tasks = await db.projectTasks.where('projectId').equals(p.id).toArray();
      const files = serializeProject(p, tasks);
      // Handle rename
      const oldPath = fileIndex.getPath(p.id);
      if (oldPath) {
        const oldDir = oldPath.split('/').slice(0, -1).join('/');
        const newDir = [...files.keys()][0]?.split('/').slice(0, -1).join('/');
        if (oldDir && newDir && oldDir !== newDir) {
          // Delete old directory files
          const oldFiles = await backend.listFiles(oldDir);
          for (const f of oldFiles) await backend.deleteFile(f);
        }
      }
      for (const [path, content] of files) {
        await backend.writeFile(path, content);
      }
      const firstPath = [...files.keys()][0];
      if (firstPath) fileIndex.set(p.id, firstPath);
      break;
    }
    case 'projectTasks': {
      // Re-serialize the parent project's tasks.md
      const task = await db.projectTasks.get(entityId);
      if (task) {
        await writeEntityToDisk(backend, PROJECTS.table, task.projectId);
      }
      break;
    }
    case 'timeEntries': {
      const e = await db.timeEntries.get(entityId);
      if (!e) return;
      // Re-serialize the entire date's time log
      const allForDate = await db.timeEntries.where('date').equals(e.date).toArray();
      const activities = await db.activities.filter(a => !a.deletedAt).toArray();
      const activityNames = new Map<string, string>();
      for (const a of activities) activityNames.set(a.id, a.name);
      const { path, content } = serializeTimeLog(e.date, allForDate, activityNames);
      await backend.writeFile(path, content);
      break;
    }
    case 'todayTasks': {
      const t = await db.todayTasks.get(entityId);
      if (!t) return;
      const allForDate = await db.todayTasks.where('date').equals(t.date).toArray();
      const allProjectTasks = await db.projectTasks.toArray();
      const taskTitles = new Map<string, string>();
      for (const pt of allProjectTasks) taskTitles.set(pt.id, pt.title);
      const { path, content } = serializeTodayTasks(t.date, allForDate, taskTitles);
      await backend.writeFile(path, content);
      break;
    }
    case 'inboxItems': {
      const allItems = await db.inboxItems.toArray();
      const activeItems = allItems.filter(i => !i.deletedAt);
      if (activeItems.length === 0) {
        if (await backend.exists(INBOX.path)) await backend.deleteFile(INBOX.path);
      } else {
        const { path, content } = serializeInbox(activeItems);
        await backend.writeFile(path, content);
      }
      break;
    }
    case 'settings': {
      const s = await db.settings.get('default');
      if (s) {
        const { path, content } = serializeSettings(s);
        await backend.writeFile(path, content);
      }
      break;
    }
    case 'projectFolders': {
      const folders = await db.projectFolders.toArray();
      const { path, content } = serializeFolders(folders);
      await backend.writeFile(path, content);
      break;
    }
  }
}

async function deleteEntityFile(backend: VaultBackend, entityId: string): Promise<void> {
  const path = fileIndex.getPath(entityId);
  if (path) {
    // If it's a project.md, delete the whole project directory
    const projectFileSuffix = `/${PROJECTS.fileName}`;
    if (path.endsWith(projectFileSuffix)) {
      const dir = path.slice(0, -projectFileSuffix.length);
      const files = await backend.listFiles(dir);
      for (const f of files) await backend.deleteFile(f);
    } else {
      await backend.deleteFile(path);
    }
    fileIndex.removeId(entityId);
  }
}

// ─── Handle external file changes (for Tauri file watcher) ───────

export async function handleExternalChange(
  backend: VaultBackend,
  filePath: string,
  eventType: 'create' | 'modify' | 'delete',
): Promise<void> {
  if (eventType === 'delete') {
    const entityId = fileIndex.getId(filePath);
    if (entityId) {
      // Soft delete in Dexie — determine table from path
      const table = tableFromPath(filePath);
      if (table) {
        await (db as any)[table].update(entityId, {
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      fileIndex.removePath(filePath);
    }
    return;
  }

  // create or modify — re-read and merge
  const content = await backend.readFile(filePath);

  if (filePath === SETTINGS.path) {
    const imported = deserializeSettings(content);
    await db.settings.put({ id: 'default', ...imported } as any);
  } else if (filePath === FOLDERS.path) {
    const folders = deserializeFolders(content);
    for (const f of folders) await mergeEntity(db.projectFolders, f);
  } else if (filePath === INBOX.path) {
    const items = deserializeInbox(content);
    for (const item of items) await mergeEntity(db.inboxItems, item);
  } else if (ACTIVITIES.matchesPath(filePath)) {
    const activity = deserializeActivity(content);
    await mergeEntity(db.activities, activity);
    fileIndex.set(activity.id, filePath);
  } else if (TIME_LOG.matchesPath(filePath)) {
    const { entries } = deserializeTimeLog(content);
    for (const e of entries) await mergeEntity(db.timeEntries, e);
  } else if (TODAY.matchesPath(filePath)) {
    const { tasks } = deserializeTodayTasks(content);
    for (const t of tasks) await mergeEntity(db.todayTasks, t);
  } else if (PROJECTS.matchesPath(filePath)) {
    const project = deserializeProject(content);
    const dirName = filePath.split('/')[1] || '';
    const nameMatch = dirName.match(/^(.+)\s+\([a-f0-9]{6}\)$/);
    project.name = nameMatch ? nameMatch[1] : dirName;
    await mergeEntity(db.projects, project);
    fileIndex.set(project.id, filePath);
  } else if (PROJECT_TASKS.matchesPath(filePath)) {
    const tasks = deserializeTasks(content);
    for (const t of tasks) await mergeEntity(db.projectTasks, t);
  }
}
