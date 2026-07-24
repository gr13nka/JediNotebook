import type {
  Activity, Project, ProjectTask, TimeEntry, TodayTask, InboxItem, UserSettings, ProjectFolder,
} from '@shared/types';
import { db } from '../db';
import { softDelete } from '../db/repository';
import type { VaultBackend } from './vaultBackend';
import { fileIndex } from './fileIndex';
import {
  ACTIVITIES, PROJECTS, PROJECT_TASKS, TIME_LOG, TODAY, INBOX, SETTINGS, FOLDERS,
} from './vaultLayout';
import type { VaultLayoutEntry } from './vaultLayout';
import {
  serializeActivity, deserializeActivity,
  serializeProjectFile, serializeProjectTasksFile, deserializeProject, deserializeProjectTasks,
  serializeTimeEntries, deserializeTimeLog,
  serializeTodayTasks, deserializeTodayTasks,
  serializeInbox, deserializeInbox,
  serializeSettings, deserializeSettings,
  serializeFolders, deserializeFolders,
} from './serializers';

/**
 * Per-kind serialization: for every entity kind in vaultLayout.ts's
 * registry, the hooks vaultSync.ts's four fan-outs (export/import/
 * single-write/external-change) need — so those fan-outs can be uniform
 * loops over `VAULT_KINDS` / `KIND_BY_TABLE` instead of a per-kind
 * switch or if-chain. See `VaultKind` below for the interface contract.
 *
 * This module is the one place that composes vaultLayout.ts (paths),
 * serializers.ts (field <-> frontmatter/JSON mapping) and Dexie (`db`)
 * into "what does this kind do" — vaultSync.ts stays generic.
 */

// ─── Shared types ───────────────────────────────────────────────────

/** A file written to (export) or read from (import) the vault. */
export interface VaultFile {
  path: string;
  content: string;
  /**
   * The entity this file is *the* file for, if any — used to key
   * `fileIndex` (id <-> path) so a later rename or delete can find it.
   * Omitted for files that aggregate multiple entities (tasks.md, a
   * per-date log) or that are singletons (settings.json, folders.json):
   * there's no single entity to index them by.
   */
  entityId?: string;
}

/** The result of parsing one already-read vault file. */
export interface ParsedFile {
  /** Dexie rows recovered from the file, ready for `mergeRow`. */
  rows: Record<string, unknown>[];
  /** Mirrors `VaultFile.entityId` — set only for a kind's self-named file. */
  entityId?: string;
}

/**
 * Distinguishes why `mergeRow` is being called: a full-vault reconcile
 * (`importAllFromDisk`, which must not clobber a newer local edit — LWW)
 * vs. a single external file-change event (`handleExternalChange`
 * create/modify — the file the user or another synced device just touched
 * is authoritative). Every kind but settings applies the same LWW policy to
 * both; settings does not — see `SETTINGS_KIND.mergeRow`'s doc comment.
 */
export type MergeSource = 'reconcile' | 'external';

/**
 * Everything one entity kind (one row of vaultLayout.ts's `VAULT_LAYOUT`)
 * needs to plug into vaultSync's four fan-outs.
 *
 * A hook MUST:
 *  - `collectFiles` / `parseFile`: be a pure function — no Dexie or backend
 *    IO. All the data they need is handed to them (`ctx`, or `content`
 *    already read from disk).
 *  - `discoverPaths` / `gatherWriteSet`: treat the backend as read-only
 *    (`listFiles` / `listDirs` / `exists`) — never write or delete through
 *    it. Actually writing/deleting stays the caller's job (vaultSync), so
 *    every mutation is visible in one place for fileIndex bookkeeping.
 *  - `gatherWriteSet` may also read Dexie (sibling rows for a per-date
 *    aggregate, a task's parent project) and the shared `fileIndex` (to
 *    detect a rename). The one kind whose write path needs another kind's
 *    logic is projectTasks, which delegates to `PROJECTS_KIND` — see its
 *    doc comment.
 */
export interface VaultKind {
  /** This kind's layout entry — dir/paths/table, from vaultLayout.ts. */
  layout: VaultLayoutEntry;

  /** Whole-vault export: every relevant row in `ctx`, turned into files. */
  collectFiles(ctx: VaultExportContext): VaultFile[];

  /** Whole-vault import: this kind's candidate file paths on `backend`. */
  discoverPaths(backend: VaultBackend): Promise<string[]>;

  /** Whole-vault import / external change: one file's content -> rows. */
  parseFile(path: string, content: string): ParsedFile;

  /** Write one parsed row into Dexie (LWW-merge — settings is the exception). */
  mergeRow(row: Record<string, unknown>, source: MergeSource): Promise<void>;

  /**
   * Live sync (debounced from a Dexie hook): the on-disk delta for one
   * entity id — files to write and stale paths to delete (a rename, or the
   * entity/its directory going away entirely).
   */
  gatherWriteSet(backend: VaultBackend, entityId: string): Promise<{ writes: VaultFile[]; deletes: string[] }>;

  /**
   * Name of the row field holding free-form user prose, if this kind has one.
   *
   * Conflict resolution merges such a field paragraph-wise instead of letting
   * last-write-wins pick a whole row: two devices appending to the same note
   * produce two equally valid bodies, and discarding either loses writing the
   * user cannot get back. Kinds whose rows are entirely structured (a task
   * list, a time log) omit this — LWW per row is already correct for them.
   */
  textField?: string;

  /**
   * Soft-delete one row, used when a three-way merge proves the other device
   * deleted it. Optional: kinds whose files are never partially deleted (a
   * singleton, a per-entity file that vanishes as a whole) don't need it.
   */
  softDeleteRow?(id: string): Promise<void>;
}

/**
 * A full snapshot of every Dexie table a kind's `collectFiles` might need —
 * including for cross-table lookups (a project's tasks, an activity-id ->
 * name map for the time log). Loaded once per export by vaultSync so every
 * kind sees a consistent snapshot, and so `collectFiles` can stay pure with
 * no Dexie access of its own. Arrays are unfiltered raw table snapshots —
 * each kind filters `deletedAt` (or not) exactly as it needs to.
 */
export interface VaultExportContext {
  activities: Activity[];
  projects: Project[];
  projectTasks: ProjectTask[];
  timeEntries: TimeEntry[];
  todayTasks: TodayTask[];
  inboxItems: InboxItem[];
  settings: UserSettings | undefined;
  projectFolders: ProjectFolder[];
}

// ─── Shared helpers ─────────────────────────────────────────────────

/**
 * Last-write-wins merge of one parsed row into a Dexie table.
 *
 * `incoming.deletedAt` is always ignored, not merged: the vault file format
 * has no `deletedAt` field at all (`omitDeleted` strips it before every
 * serialize, so nothing ever writes it to disk, and no deserializer reads
 * it back). A file's *absence* is what represents deletion in the vault —
 * handled separately, via `gatherWriteSet`'s `deletes` list and the
 * discover/reconcile diff — not a field on the row. So the local row's own
 * `deletedAt` (Dexie's soft-delete state) is always the authority: kept
 * as-is on an update, and `null` for a brand-new row (a file that exists on
 * disk can't already be soft-deleted locally).
 */
async function mergeEntity(table: any, incoming: any): Promise<void> {
  const existing = await table.get(incoming.id);
  if (!existing) {
    await table.put({ ...incoming, deletedAt: null });
    return;
  }
  if (incoming.updatedAt > (existing.updatedAt || '')) {
    await table.put({ ...incoming, deletedAt: existing.deletedAt });
  }
}

/** 'projects/<dirName>/project.md' -> '<dirName>' (the segment right before the filename). */
function dirNameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 2] || '';
}

/** 'projects/<dirName>/project.md' -> 'projects/<dirName>' */
function dirOf(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

// ─── Activities ───────────────────────────────────────────────────

const ACTIVITIES_KIND: VaultKind = {
  layout: ACTIVITIES,

  collectFiles(ctx) {
    return ctx.activities.filter(a => !a.deletedAt).map(a => {
      const { path, content } = serializeActivity(a);
      return { path, content, entityId: a.id };
    });
  },

  async discoverPaths(backend) {
    return backend.listFiles(ACTIVITIES.dir, ACTIVITIES.fileExtension);
  },

  parseFile(_path, content) {
    const activity = deserializeActivity(content);
    return { rows: [activity], entityId: activity.id };
  },

  async mergeRow(row) {
    await mergeEntity(db.activities, row);
  },

  async gatherWriteSet(_backend, entityId) {
    const a = await db.activities.get(entityId);
    const oldPath = fileIndex.getPath(entityId);
    if (!a || a.deletedAt) {
      return { writes: [], deletes: oldPath ? [oldPath] : [] };
    }
    const { path, content } = serializeActivity(a);
    const deletes = oldPath && oldPath !== path ? [oldPath] : [];
    return { writes: [{ path, content, entityId: a.id }], deletes };
  },
};

// ─── Projects (+ tasks) ───────────────────────────────────────────

const PROJECTS_KIND: VaultKind = {
  layout: PROJECTS,

  // project.md's body is the project's free-text note — the one field here
  // that two devices can both legitimately extend while offline.
  textField: 'description',

  collectFiles(ctx) {
    return ctx.projects.filter(p => !p.deletedAt).map(p => {
      const { path, content } = serializeProjectFile(p);
      return { path, content, entityId: p.id };
    });
  },

  async discoverPaths(backend) {
    const dirs = await backend.listDirs(PROJECTS.dir);
    const paths: string[] = [];
    for (const dir of dirs) {
      const path = `${dir}/${PROJECTS.fileName}`;
      if (await backend.exists(path)) paths.push(path);
    }
    return paths;
  },

  parseFile(path, content) {
    const project = deserializeProject(dirNameFromPath(path), content);
    return { rows: [project], entityId: project.id };
  },

  async mergeRow(row) {
    await mergeEntity(db.projects, row);
  },

  async gatherWriteSet(backend, entityId) {
    const p = await db.projects.get(entityId);
    const oldPath = fileIndex.getPath(entityId);
    if (!p || p.deletedAt) {
      if (!oldPath) return { writes: [], deletes: [] };
      const staleFiles = await backend.listFiles(dirOf(oldPath));
      return { writes: [], deletes: staleFiles };
    }
    const tasks = await db.projectTasks.where('projectId').equals(p.id).toArray();
    const projectFile = serializeProjectFile(p);
    const tasksFile = serializeProjectTasksFile(p, tasks);
    let deletes: string[] = [];
    if (oldPath && dirOf(oldPath) !== dirOf(projectFile.path)) {
      deletes = await backend.listFiles(dirOf(oldPath));
    }
    return {
      writes: [{ ...projectFile, entityId: p.id }, tasksFile],
      deletes,
    };
  },
};

const PROJECT_TASKS_KIND: VaultKind = {
  layout: PROJECT_TASKS,

  collectFiles(ctx) {
    return ctx.projects.filter(p => !p.deletedAt).map(p => {
      const tasks = ctx.projectTasks.filter(t => t.projectId === p.id);
      return serializeProjectTasksFile(p, tasks);
    });
  },

  async discoverPaths(backend) {
    const dirs = await backend.listDirs(PROJECT_TASKS.dir);
    const paths: string[] = [];
    for (const dir of dirs) {
      const path = `${dir}/${PROJECT_TASKS.fileName}`;
      if (await backend.exists(path)) paths.push(path);
    }
    return paths;
  },

  parseFile(_path, content) {
    return { rows: deserializeProjectTasks(content) };
  },

  async mergeRow(row) {
    await mergeEntity(db.projectTasks, row);
  },

  // tasks.md lists a whole project's tasks, so one task can vanish from the
  // file while the file itself stays — the one case where a merge has to
  // delete a row rather than infer deletion from a missing file.
  async softDeleteRow(id) {
    await softDelete(db.projectTasks, id);
  },

  /**
   * A task doesn't own a file of its own — tasks.md is the whole project's
   * task list. Delegate to PROJECTS_KIND for the task's parent project,
   * which re-serializes both project.md and tasks.md. This mirrors the
   * pre-3.1b behavior (a task edit always rewrote both project files, not
   * just tasks.md) rather than narrowing what gets written.
   */
  async gatherWriteSet(backend, entityId) {
    const task = await db.projectTasks.get(entityId);
    if (!task) return { writes: [], deletes: [] };
    return PROJECTS_KIND.gatherWriteSet(backend, task.projectId);
  },
};

// ─── Time log (per-date) ──────────────────────────────────────────

const TIME_LOG_KIND: VaultKind = {
  layout: TIME_LOG,

  collectFiles(ctx) {
    const activeEntries = ctx.timeEntries.filter(e => !e.deletedAt);
    const byDate = new Map<string, TimeEntry[]>();
    for (const e of activeEntries) {
      const arr = byDate.get(e.date) || [];
      arr.push(e);
      byDate.set(e.date, arr);
    }
    const activityNames = new Map(
      ctx.activities.filter(a => !a.deletedAt).map(a => [a.id, a.name] as const),
    );
    const files: VaultFile[] = [];
    for (const [date, entries] of byDate) {
      const { path, content } = serializeTimeEntries(date, entries, activityNames);
      files.push({ path, content });
    }
    return files;
  },

  async discoverPaths(backend) {
    if (!(await backend.exists(TIME_LOG.dir))) return [];
    return backend.listFiles(TIME_LOG.dir, TIME_LOG.fileExtension);
  },

  parseFile(_path, content) {
    const { entries } = deserializeTimeLog(content);
    return { rows: entries };
  },

  async mergeRow(row) {
    await mergeEntity(db.timeEntries, row);
  },

  async gatherWriteSet(_backend, entityId) {
    const e = await db.timeEntries.get(entityId);
    if (!e) return { writes: [], deletes: [] };
    const allForDate = await db.timeEntries.where('date').equals(e.date).toArray();
    const activities = await db.activities.filter(a => !a.deletedAt).toArray();
    const activityNames = new Map(activities.map(a => [a.id, a.name] as const));
    const { path, content } = serializeTimeEntries(e.date, allForDate, activityNames);
    return { writes: [{ path, content }], deletes: [] };
  },
};

// ─── Today tasks (per-date) ───────────────────────────────────────

const TODAY_KIND: VaultKind = {
  layout: TODAY,

  collectFiles(ctx) {
    const activeTasks = ctx.todayTasks.filter(t => !t.deletedAt);
    const byDate = new Map<string, TodayTask[]>();
    for (const t of activeTasks) {
      const arr = byDate.get(t.date) || [];
      arr.push(t);
      byDate.set(t.date, arr);
    }
    const taskTitles = new Map(ctx.projectTasks.map(t => [t.id, t.title] as const));
    const files: VaultFile[] = [];
    for (const [date, tasks] of byDate) {
      const { path, content } = serializeTodayTasks(date, tasks, taskTitles);
      files.push({ path, content });
    }
    return files;
  },

  async discoverPaths(backend) {
    if (!(await backend.exists(TODAY.dir))) return [];
    return backend.listFiles(TODAY.dir, TODAY.fileExtension);
  },

  parseFile(_path, content) {
    const { tasks } = deserializeTodayTasks(content);
    return { rows: tasks };
  },

  async mergeRow(row) {
    await mergeEntity(db.todayTasks, row);
  },

  async gatherWriteSet(_backend, entityId) {
    const t = await db.todayTasks.get(entityId);
    if (!t) return { writes: [], deletes: [] };
    const allForDate = await db.todayTasks.where('date').equals(t.date).toArray();
    const allProjectTasks = await db.projectTasks.toArray();
    const taskTitles = new Map(allProjectTasks.map(pt => [pt.id, pt.title] as const));
    const { path, content } = serializeTodayTasks(t.date, allForDate, taskTitles);
    return { writes: [{ path, content }], deletes: [] };
  },
};

// ─── Inbox (singleton) ────────────────────────────────────────────

const INBOX_KIND: VaultKind = {
  layout: INBOX,

  collectFiles(ctx) {
    const activeItems = ctx.inboxItems.filter(i => !i.deletedAt);
    if (activeItems.length === 0) return [];
    const { path, content } = serializeInbox(activeItems);
    return [{ path, content }];
  },

  async discoverPaths(backend) {
    return (await backend.exists(INBOX.path)) ? [INBOX.path] : [];
  },

  parseFile(_path, content) {
    return { rows: deserializeInbox(content) };
  },

  async mergeRow(row) {
    await mergeEntity(db.inboxItems, row);
  },

  async gatherWriteSet(backend, _entityId) {
    const allItems = await db.inboxItems.toArray();
    const activeItems = allItems.filter(i => !i.deletedAt);
    if (activeItems.length === 0) {
      const has = await backend.exists(INBOX.path);
      return { writes: [], deletes: has ? [INBOX.path] : [] };
    }
    const { path, content } = serializeInbox(activeItems);
    return { writes: [{ path, content }], deletes: [] };
  },
};

// ─── Settings (singleton) ─────────────────────────────────────────

const SETTINGS_KIND: VaultKind = {
  layout: SETTINGS,

  collectFiles(ctx) {
    if (!ctx.settings) return [];
    const { path, content } = serializeSettings(ctx.settings);
    return [{ path, content }];
  },

  async discoverPaths(backend) {
    return (await backend.exists(SETTINGS.path)) ? [SETTINGS.path] : [];
  },

  parseFile(_path, content) {
    return { rows: [deserializeSettings(content) as Record<string, unknown>] };
  },

  /**
   * Settings predates a uniform LWW policy and keeps its own, pre-3.1b:
   * a whole-vault reconcile only takes the file if settings don't exist
   * locally yet or the file is newer (settings has no `deletedAt`, so this
   * can't reuse the generic `mergeEntity`); a live external file-change
   * event is unconditional — the file was just touched by the user or
   * another synced device, so it always wins. Preserved as-is here, not
   * introduced by this refactor.
   */
  async mergeRow(row, source) {
    const imported = row as Partial<UserSettings>;
    if (source === 'external') {
      await db.settings.put({ id: 'default', ...imported } as UserSettings);
      return;
    }
    const existing = await db.settings.get('default');
    if (!existing || (imported.updatedAt && imported.updatedAt > (existing.updatedAt || ''))) {
      await db.settings.put({ id: 'default', ...imported } as UserSettings);
    }
  },

  async gatherWriteSet(_backend, _entityId) {
    const s = await db.settings.get('default');
    if (!s) return { writes: [], deletes: [] };
    const { path, content } = serializeSettings(s);
    return { writes: [{ path, content }], deletes: [] };
  },
};

// ─── Project folders (singleton) ──────────────────────────────────

const FOLDERS_KIND: VaultKind = {
  layout: FOLDERS,

  collectFiles(ctx) {
    if (ctx.projectFolders.length === 0) return [];
    const { path, content } = serializeFolders(ctx.projectFolders);
    return [{ path, content }];
  },

  async discoverPaths(backend) {
    return (await backend.exists(FOLDERS.path)) ? [FOLDERS.path] : [];
  },

  parseFile(_path, content) {
    return { rows: deserializeFolders(content) };
  },

  async mergeRow(row) {
    await mergeEntity(db.projectFolders, row);
  },

  async gatherWriteSet(_backend, _entityId) {
    const folders = await db.projectFolders.toArray();
    const { path, content } = serializeFolders(folders);
    return { writes: [{ path, content }], deletes: [] };
  },
};

// ─── Registry ─────────────────────────────────────────────────────

/** Every entity kind, in the same order as vaultLayout.ts's VAULT_LAYOUT. */
export const VAULT_KINDS: VaultKind[] = [
  ACTIVITIES_KIND, PROJECTS_KIND, PROJECT_TASKS_KIND, TIME_LOG_KIND, TODAY_KIND,
  INBOX_KIND, SETTINGS_KIND, FOLDERS_KIND,
];

/** Dexie table name -> the kind that owns it. */
export const KIND_BY_TABLE: Record<string, VaultKind> = Object.fromEntries(
  VAULT_KINDS.map(k => [k.layout.table, k]),
);
