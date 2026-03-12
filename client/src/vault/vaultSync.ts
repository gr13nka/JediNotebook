import { db } from '../db';
import type { VaultBackend } from './vaultBackend';
import { FileIndex } from './fileIndex';
import {
  serializeActivity, deserializeActivity,
  serializeNote, deserializeNote,
  serializeProject, deserializeProject, deserializeTasks,
  serializeHabit, deserializeHabit,
  serializeTimeLog, deserializeTimeLog,
  serializeTodayTasks, deserializeTodayTasks,
  serializeMindMap, deserializeMindMap,
  serializeInbox, deserializeInbox,
  serializeSettings, deserializeSettings,
  serializePomodoroPresets, deserializePomodoroPresets,
  serializeFolders, deserializeFolders,
  serializePdfMeta, pdfBinaryPath, deserializePdfMeta,
} from './serializers';
import { extractShortIdFromFilename, uuidMatchesShortId } from './sanitize';

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
  for (const dir of ['activities', 'notes', 'projects', 'habits', 'mind-maps', 'time-log', 'today', 'pdfs']) {
    await backend.mkdir(dir);
  }

  // Settings
  const settings = await db.settings.get('default');
  if (settings) {
    const { path, content } = serializeSettings(settings);
    await backend.writeFile(path, content);
  }

  // Pomodoro presets
  const presets = await db.pomodoroPresets.toArray();
  if (presets.length > 0) {
    const { path, content } = serializePomodoroPresets(presets);
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

  // Notes
  const notes = await db.notes.filter(n => !n.deletedAt).toArray();
  for (const n of notes) {
    const { path, content } = serializeNote(n);
    await backend.writeFile(path, content);
    fileIndex.set(n.id, path);
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

  // Habits + Entries
  const habits = await db.habits.filter(h => !h.deletedAt).toArray();
  for (const h of habits) {
    const entries = await db.habitEntries.where('habitId').equals(h.id).toArray();
    const { path, content } = serializeHabit(h, entries);
    await backend.writeFile(path, content);
    fileIndex.set(h.id, path);
  }

  // Mind maps
  const mindMaps = await db.mindMaps.filter(m => !m.deletedAt).toArray();
  for (const m of mindMaps) {
    const { path, content } = serializeMindMap(m);
    await backend.writeFile(path, content);
    fileIndex.set(m.id, path);
  }

  // Inbox (single file for all items)
  const inboxItems = await db.inboxItems.filter(i => !i.deletedAt).toArray();
  if (inboxItems.length > 0) {
    const { path, content } = serializeInbox(inboxItems);
    await backend.writeFile(path, content);
  }

  // PDF documents
  const pdfDocs = await db.pdfDocuments.filter(p => !p.deletedAt).toArray();
  for (const pdf of pdfDocs) {
    const { path, content } = serializePdfMeta(pdf);
    await backend.writeFile(path, content);
    fileIndex.set(pdf.id, path);
    // Write binary PDF file
    if (backend.writeBinaryFile) {
      const binPath = pdfBinaryPath(pdf);
      const arrayBuf = await pdf.pdfData.arrayBuffer();
      await backend.writeBinaryFile(binPath, new Uint8Array(arrayBuf));
    }
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
    if (await safeExists('settings.json')) {
      const content = await backend.readFile('settings.json');
      const imported = deserializeSettings(content);
      const existing = await db.settings.get('default');
      if (!existing || (imported.updatedAt && imported.updatedAt > (existing.updatedAt || ''))) {
        await db.settings.put({ id: 'default', ...imported } as any);
        counts.settings = 1;
      }
    }
  } catch (err) { errors.push(`settings: ${err}`); }

  // Pomodoro presets
  try {
    if (await safeExists('pomodoro-presets.json')) {
      const content = await backend.readFile('pomodoro-presets.json');
      const presets = deserializePomodoroPresets(content);
      for (const p of presets) {
        await mergeEntity(db.pomodoroPresets, p);
      }
    }
  } catch (err) { errors.push(`presets: ${err}`); }

  // Folders
  try {
    if (await safeExists('folders.json')) {
      const content = await backend.readFile('folders.json');
      const folders = deserializeFolders(content);
      for (const f of folders) {
        await mergeEntity(db.projectFolders, f);
      }
    }
  } catch (err) { errors.push(`folders: ${err}`); }

  // Activities
  try {
    const activityFiles = await backend.listFiles('activities', '.md');
    for (const filePath of activityFiles) {
      const content = await backend.readFile(filePath);
      const activity = deserializeActivity(content);
      await mergeEntity(db.activities, activity);
      fileIndex.set(activity.id, filePath);
    }
    counts.activities = activityFiles.length;
  } catch (err) { errors.push(`activities: ${err}`); }

  // Notes
  try {
    const noteFiles = await backend.listFiles('notes', '.md');
    for (const filePath of noteFiles) {
      const content = await backend.readFile(filePath);
      const note = deserializeNote(content);
      await mergeEntity(db.notes, note);
      fileIndex.set(note.id, filePath);
    }
    counts.notes = noteFiles.length;
  } catch (err) { errors.push(`notes: ${err}`); }

  // Projects + Tasks
  try {
    let projectCount = 0;
    const projectDirs = await backend.listDirs('projects');
    for (const dirPath of projectDirs) {
      const projectPath = dirPath + '/project.md';
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
      const tasksPath = dirPath + '/tasks.md';
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

  // Habits
  try {
    const habitFiles = await backend.listFiles('habits', '.md');
    for (const filePath of habitFiles) {
      const content = await backend.readFile(filePath);
      const { habit, entries } = deserializeHabit(content);
      await mergeEntity(db.habits, habit);
      fileIndex.set(habit.id, filePath);
      for (const e of entries) {
        await mergeEntity(db.habitEntries, e);
      }
    }
    counts.habits = habitFiles.length;
  } catch (err) { errors.push(`habits: ${err}`); }

  // Mind maps
  try {
    const mindMapFiles = await backend.listFiles('mind-maps', '.md');
    for (const filePath of mindMapFiles) {
      const content = await backend.readFile(filePath);
      const mindMap = deserializeMindMap(content);
      await mergeEntity(db.mindMaps, mindMap);
      fileIndex.set(mindMap.id, filePath);
    }
    counts.mindMaps = mindMapFiles.length;
  } catch (err) { errors.push(`mindMaps: ${err}`); }

  // Inbox
  try {
    if (await safeExists('inbox.md')) {
      const content = await backend.readFile('inbox.md');
      const items = deserializeInbox(content);
      for (const item of items) {
        await mergeEntity(db.inboxItems, item);
      }
    }
  } catch (err) { errors.push(`inbox: ${err}`); }

  // PDF documents
  try {
    if (await safeExists('pdfs')) {
      const pdfMetaFiles = await backend.listFiles('pdfs', '.json');
      for (const filePath of pdfMetaFiles) {
        const content = await backend.readFile(filePath);
        const pdfMeta = deserializePdfMeta(content);
        // Try to read the binary PDF
        const binPath = filePath.replace(/\.json$/, '.pdf');
        let pdfData: Blob | null = null;
        let thumbnail: Blob | null = null;
        if (backend.readBinaryFile && await safeExists(binPath)) {
          try {
            const bytes = await backend.readBinaryFile(binPath);
            pdfData = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
            // Generate thumbnail
            try {
              const { generatePdfThumbnail } = await import('../utils/pdfThumbnail');
              thumbnail = await generatePdfThumbnail(bytes.buffer as ArrayBuffer);
            } catch { /* thumbnail generation is optional */ }
          } catch (binErr) {
            errors.push(`pdf binary "${binPath}": ${binErr}`);
          }
        }
        // Import metadata even if binary read failed — use existing local binary or empty placeholder
        const existing = await db.pdfDocuments.get(pdfMeta.id);
        const effectivePdfData = pdfData || (existing?.pdfData?.size ? existing.pdfData : new Blob([], { type: 'application/pdf' }));
        const effectiveThumbnail = thumbnail || existing?.thumbnail || null;
        if (!existing) {
          await db.pdfDocuments.put({
            ...pdfMeta,
            pdfData: effectivePdfData,
            thumbnail: effectiveThumbnail,
            deletedAt: null,
          });
        } else if (pdfMeta.updatedAt > (existing.updatedAt || '')) {
          await db.pdfDocuments.put({
            ...pdfMeta,
            pdfData: effectivePdfData,
            thumbnail: effectiveThumbnail,
            deletedAt: existing.deletedAt,
          });
        }
        fileIndex.set(pdfMeta.id, filePath);
      }
    }
  } catch (err) { errors.push(`pdfs: ${err}`); }

  // Time logs
  try {
    if (await safeExists('time-log')) {
      const timeLogFiles = await backend.listFiles('time-log', '.md');
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
    if (await safeExists('today')) {
      const todayFiles = await backend.listFiles('today', '.md');
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
    case 'notes': {
      const n = await db.notes.get(entityId);
      if (!n || n.deletedAt) {
        await deleteEntityFile(backend, entityId);
        return;
      }
      const { path, content } = serializeNote(n);
      const oldPath = fileIndex.getPath(n.id);
      if (oldPath && oldPath !== path) await backend.deleteFile(oldPath);
      await backend.writeFile(path, content);
      fileIndex.set(n.id, path);
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
        await writeEntityToDisk(backend, 'projects', task.projectId);
      }
      break;
    }
    case 'habits': {
      const h = await db.habits.get(entityId);
      if (!h || h.deletedAt) {
        await deleteEntityFile(backend, entityId);
        return;
      }
      const entries = await db.habitEntries.where('habitId').equals(h.id).toArray();
      const { path, content } = serializeHabit(h, entries);
      const oldPath = fileIndex.getPath(h.id);
      if (oldPath && oldPath !== path) await backend.deleteFile(oldPath);
      await backend.writeFile(path, content);
      fileIndex.set(h.id, path);
      break;
    }
    case 'habitEntries': {
      // Re-serialize the parent habit
      const entry = await db.habitEntries.get(entityId);
      if (entry) {
        await writeEntityToDisk(backend, 'habits', entry.habitId);
      }
      break;
    }
    case 'mindMaps': {
      const m = await db.mindMaps.get(entityId);
      if (!m || m.deletedAt) {
        await deleteEntityFile(backend, entityId);
        return;
      }
      const { path, content } = serializeMindMap(m);
      const oldPath = fileIndex.getPath(m.id);
      if (oldPath && oldPath !== path) await backend.deleteFile(oldPath);
      await backend.writeFile(path, content);
      fileIndex.set(m.id, path);
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
        if (await backend.exists('inbox.md')) await backend.deleteFile('inbox.md');
      } else {
        const { path, content } = serializeInbox(activeItems);
        await backend.writeFile(path, content);
      }
      break;
    }
    case 'pdfDocuments': {
      const pdf = await db.pdfDocuments.get(entityId);
      if (!pdf || pdf.deletedAt) {
        // Delete both sidecar and binary
        const oldPath = fileIndex.getPath(entityId);
        if (oldPath) {
          await backend.deleteFile(oldPath);
          await backend.deleteFile(oldPath.replace(/\.json$/, '.pdf')).catch(() => {});
          fileIndex.removeId(entityId);
        }
        return;
      }
      const { path, content } = serializePdfMeta(pdf);
      const oldPath = fileIndex.getPath(pdf.id);
      if (oldPath && oldPath !== path) {
        await backend.deleteFile(oldPath);
        await backend.deleteFile(oldPath.replace(/\.json$/, '.pdf')).catch(() => {});
      }
      await backend.writeFile(path, content);
      if (backend.writeBinaryFile) {
        try {
          const binPath = pdfBinaryPath(pdf);
          const arrayBuf = await pdf.pdfData.arrayBuffer();
          await backend.writeBinaryFile(binPath, new Uint8Array(arrayBuf));
        } catch (binErr) {
          // Binary write failed — remove orphaned metadata file so next sync retries fully
          await backend.deleteFile(path).catch(() => {});
          fileIndex.removeId(pdf.id);
          console.error('[vault] PDF binary write failed, removed metadata:', binErr);
          break;
        }
      }
      fileIndex.set(pdf.id, path);
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
    case 'pomodoroPresets': {
      const presets = await db.pomodoroPresets.toArray();
      const { path, content } = serializePomodoroPresets(presets);
      await backend.writeFile(path, content);
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
    if (path.endsWith('/project.md')) {
      const dir = path.replace('/project.md', '');
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

  if (filePath === 'settings.json') {
    const imported = deserializeSettings(content);
    await db.settings.put({ id: 'default', ...imported } as any);
  } else if (filePath === 'pomodoro-presets.json') {
    const presets = deserializePomodoroPresets(content);
    for (const p of presets) await mergeEntity(db.pomodoroPresets, p);
  } else if (filePath === 'folders.json') {
    const folders = deserializeFolders(content);
    for (const f of folders) await mergeEntity(db.projectFolders, f);
  } else if (filePath === 'inbox.md') {
    const items = deserializeInbox(content);
    for (const item of items) await mergeEntity(db.inboxItems, item);
  } else if (filePath.startsWith('activities/')) {
    const activity = deserializeActivity(content);
    await mergeEntity(db.activities, activity);
    fileIndex.set(activity.id, filePath);
  } else if (filePath.startsWith('notes/')) {
    const note = deserializeNote(content);
    await mergeEntity(db.notes, note);
    fileIndex.set(note.id, filePath);
  } else if (filePath.startsWith('habits/')) {
    const { habit, entries } = deserializeHabit(content);
    await mergeEntity(db.habits, habit);
    fileIndex.set(habit.id, filePath);
    for (const e of entries) await mergeEntity(db.habitEntries, e);
  } else if (filePath.startsWith('mind-maps/')) {
    const mindMap = deserializeMindMap(content);
    await mergeEntity(db.mindMaps, mindMap);
    fileIndex.set(mindMap.id, filePath);
  } else if (filePath.startsWith('time-log/')) {
    const { entries } = deserializeTimeLog(content);
    for (const e of entries) await mergeEntity(db.timeEntries, e);
  } else if (filePath.startsWith('today/')) {
    const { tasks } = deserializeTodayTasks(content);
    for (const t of tasks) await mergeEntity(db.todayTasks, t);
  } else if (filePath.startsWith('pdfs/') && filePath.endsWith('.json')) {
    const content = await backend.readFile(filePath);
    const pdfMeta = deserializePdfMeta(content);
    // Try to read the corresponding binary PDF
    const binPath = filePath.replace(/\.json$/, '.pdf');
    let pdfData: Blob | null = null;
    let thumbnail: Blob | null = null;
    if (backend.readBinaryFile && await backend.exists(binPath)) {
      const bytes = await backend.readBinaryFile(binPath);
      pdfData = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
      try {
        const { generatePdfThumbnail } = await import('../utils/pdfThumbnail');
        thumbnail = await generatePdfThumbnail(bytes.buffer as ArrayBuffer);
      } catch { /* optional */ }
    }
    if (pdfData) {
      const existing = await db.pdfDocuments.get(pdfMeta.id);
      if (!existing) {
        await db.pdfDocuments.put({ ...pdfMeta, pdfData, thumbnail, deletedAt: null });
      } else if (pdfMeta.updatedAt > (existing.updatedAt || '')) {
        await db.pdfDocuments.put({ ...pdfMeta, pdfData, thumbnail, deletedAt: existing.deletedAt });
      }
      fileIndex.set(pdfMeta.id, filePath);
    }
  } else if (filePath.startsWith('pdfs/') && filePath.endsWith('.pdf')) {
    // Binary PDF dropped into folder — look for sidecar .json, otherwise create entry
    const jsonPath = filePath.replace(/\.pdf$/, '.json');
    if (await backend.exists(jsonPath)) {
      // Re-process via the json handler
      await handleExternalChange(backend, jsonPath, eventType);
    } else if (backend.readBinaryFile) {
      // New PDF with no sidecar — create one
      const bytes = await backend.readBinaryFile(filePath);
      const pdfData = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
      let thumbnail: Blob | null = null;
      let pageCount = 0;
      try {
        const { generatePdfThumbnail, getPdfPageCount } = await import('../utils/pdfThumbnail');
        pageCount = await getPdfPageCount(bytes.buffer as ArrayBuffer);
        thumbnail = await generatePdfThumbnail(bytes.buffer as ArrayBuffer);
      } catch { /* optional */ }
      const { generateId, getDeviceId } = await import('../utils/uuid');
      const now = new Date().toISOString();
      const fileName = filePath.split('/').pop() || 'document.pdf';
      const title = fileName.replace(/\.pdf$/i, '');
      const pdf = {
        id: generateId(),
        title,
        fileName,
        fileSize: bytes.length,
        pageCount,
        color: '#E04848',
        isPinned: false,
        thumbnail,
        pdfData,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deviceId: getDeviceId(),
      };
      await db.pdfDocuments.put(pdf);
      // Write sidecar for future sync
      const { serializePdfMeta: serMeta } = await import('./serializers');
      const { path, content } = serMeta(pdf);
      await backend.writeFile(path, content);
      fileIndex.set(pdf.id, path);
    }
  } else if (filePath.match(/^projects\/[^/]+\/project\.md$/)) {
    const project = deserializeProject(content);
    const dirName = filePath.split('/')[1] || '';
    const nameMatch = dirName.match(/^(.+)\s+\([a-f0-9]{6}\)$/);
    project.name = nameMatch ? nameMatch[1] : dirName;
    await mergeEntity(db.projects, project);
    fileIndex.set(project.id, filePath);
  } else if (filePath.match(/^projects\/[^/]+\/tasks\.md$/)) {
    const tasks = deserializeTasks(content);
    for (const t of tasks) await mergeEntity(db.projectTasks, t);
  }
}

function tableFromPath(filePath: string): string | null {
  if (filePath.startsWith('activities/')) return 'activities';
  if (filePath.startsWith('notes/')) return 'notes';
  if (filePath.startsWith('habits/')) return 'habits';
  if (filePath.startsWith('mind-maps/')) return 'mindMaps';
  if (filePath.startsWith('pdfs/')) return 'pdfDocuments';
  if (filePath.startsWith('time-log/')) return 'timeEntries';
  if (filePath.startsWith('today/')) return 'todayTasks';
  if (filePath.match(/^projects\/[^/]+\/project\.md$/)) return 'projects';
  if (filePath.match(/^projects\/[^/]+\/tasks\.md$/)) return 'projectTasks';
  return null;
}
