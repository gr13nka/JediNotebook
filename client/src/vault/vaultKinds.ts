import type {
  Activity, Project, ProjectTask, TimeEntry, TodayTask, InboxItem, UserSettings, ProjectFolder,
} from '@shared/types';
import { db } from '../db';
import { softDelete } from '../db/repository';
import type { VaultBackend } from './vaultBackend';
import { fileIndex } from './fileIndex';
import { parseFrontmatter } from './frontmatter';
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
  /**
   * The scope this AGGREGATE file belongs to — a project id for `tasks.md`,
   * a calendar date for a per-date log — set by a kind whose `rowBelongsTo`
   * needs to know the file's own scope even when `rows` is empty (every row
   * moved or was deleted away). Unlike `entityId`, this file isn't *the*
   * file for this id; it's *scoped* to it. Read straight from the file's own
   * frontmatter/JSON, never from a row, so it survives an empty `rows`.
   */
  ownerId?: string;
}


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

  /** Write one parsed row into Dexie (LWW-merge). */
  mergeRow(row: Record<string, unknown>): Promise<void>;

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

  /**
   * Membership check for a `softDeleteRow` kind whose rows can move to a
   * DIFFERENT file of the same kind — a `ProjectTask` reassigned to another
   * project (`moveTaskToProject`), a `TimeEntry`/`TodayTask` whose `date`
   * changed. Without it, a base-diff ("id was in the base for this path,
   * missing from this file") can't tell a genuine deletion from a row that
   * simply lives on somewhere else now — both look identical from one
   * file's point of view.
   *
   * `liveRow` is the row currently in Dexie for an id the base-diff found
   * missing from this file; `ownerId` is this file's own scope
   * (`ParsedFile.ownerId` — the project id or date the file is FOR, read
   * from its own content, not from any row). Returns false ("this row
   * migrated, it wasn't deleted") to skip the soft-delete for it.
   *
   * Optional: absent for a kind whose rows never move between files of that
   * kind (aggregates with exactly one live file — `INBOX_KIND`,
   * `FOLDERS_KIND`) or that has no `softDeleteRow` at all, where every
   * caller treats an absent hook as "proceed with the soft-delete", i.e.
   * the pre-CRITICAL-2 behavior.
   */
  rowBelongsTo?(liveRow: Record<string, unknown>, ownerId: string | undefined): boolean;
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
    // `ownerId` reads `projectId` straight from the frontmatter rather than
    // from `deserializeProjectTasks`'s rows (which carry the same value per
    // row, copied from this same field) so it survives a file with zero
    // active tasks — the shape a project takes on once every task has moved
    // away or been deleted, which `rowBelongsTo` below must still resolve.
    const { meta } = parseFrontmatter(content);
    return { rows: deserializeProjectTasks(content), ownerId: meta.projectId as string };
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

  // moveTaskToProject (db/taskOps.ts) reassigns a task's projectId, which
  // moves it to a DIFFERENT project's tasks.md. A base-diff against its old
  // project's file alone can't distinguish that from a genuine deletion —
  // the live row's current projectId is the only thing that can.
  rowBelongsTo(liveRow, ownerId) {
    return (liveRow as { projectId?: string }).projectId === ownerId;
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
    // `ownerId` (the date) comes straight from `deserializeTimeLog`'s own
    // return value, not from a row, so it survives a file with zero active
    // entries — the shape a date takes on once every entry has moved to
    // another date or been deleted, which `rowBelongsTo` below must still
    // resolve.
    const { date, entries } = deserializeTimeLog(content);
    return { rows: entries, ownerId: date };
  },

  async mergeRow(row) {
    await mergeEntity(db.timeEntries, row);
  },

  // A date file lists a whole day's entries, so one entry can vanish from the
  // file while the file itself stays — same shape as PROJECT_TASKS_KIND.
  async softDeleteRow(id) {
    await softDelete(db.timeEntries, id);
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

  // A TimeEntry's `date` can change (editing a manual entry), moving it to a
  // different date file — same "moved, not deleted" hazard as a task's
  // projectId. See PROJECT_TASKS_KIND.rowBelongsTo.
  rowBelongsTo(liveRow, ownerId) {
    return (liveRow as { date?: string }).date === ownerId;
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
    // See TIME_LOG_KIND.parseFile: `ownerId` comes from the parsed date
    // itself so it survives a file with zero active tasks.
    const { date, tasks } = deserializeTodayTasks(content);
    return { rows: tasks, ownerId: date };
  },

  async mergeRow(row) {
    await mergeEntity(db.todayTasks, row);
  },

  // Same shape as PROJECT_TASKS_KIND/TIME_LOG_KIND: a date file aggregates a
  // whole day's tasks, so one task can vanish from the file while it stays.
  async softDeleteRow(id) {
    await softDelete(db.todayTasks, id);
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

  // Same "moved, not deleted" hazard as TIME_LOG_KIND, for a TodayTask's own
  // `date` field.
  rowBelongsTo(liveRow, ownerId) {
    return (liveRow as { date?: string }).date === ownerId;
  },
};

// ─── Inbox (singleton) ────────────────────────────────────────────

const INBOX_KIND: VaultKind = {
  layout: INBOX,

  // Once the inbox has ever had a row (including soft-deleted ones),
  // inbox.md keeps existing as a valid empty-items file rather than being
  // deleted — same "ever had rows" rule FOLDERS_KIND already applies below.
  // A deleted last item must show up to a peer as a row missing from an
  // existing file (a MODIFY the C12 base-diff can infer as a deletion), not
  // as the file itself disappearing: an aggregate file has no `fileIndex`
  // entry, so a peer's delete-event handler has nothing to act on and its
  // own next export simply resurrects the item. Only a table that has never
  // held a row at all (a vault that was never used) emits nothing.
  collectFiles(ctx) {
    if (ctx.inboxItems.length === 0) return [];
    const { path, content } = serializeInbox(ctx.inboxItems);
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

  // inbox.md lists every item in one file, so one item can vanish from it
  // while the file itself stays — same shape as PROJECT_TASKS_KIND.
  async softDeleteRow(id) {
    await softDelete(db.inboxItems, id);
  },

  // No zero-rows guard: unlike collectFiles (which runs over a whole-vault
  // snapshot that can legitimately be empty), this only ever runs from a
  // dexieHooks creating/updating callback (queued with the row's own id) or
  // from conflictResolver's post-merge rewrite (whose id is either a
  // surviving row or one just proven deleted via softDeleteRow, which still
  // leaves it in the table) — every caller's entityId names a row that
  // exists, so `allItems` can never actually be empty here.
  async gatherWriteSet(_backend, _entityId) {
    const allItems = await db.inboxItems.toArray();
    const { path, content } = serializeInbox(allItems);
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
   * Both sources take the same strict-`>` LWW rule (settings has no
   * `deletedAt`, so this can't reuse the generic `mergeEntity`): apply the
   * imported row only if no local row exists yet or the imported row is
   * strictly newer. A live external file-change event used to be
   * unconditional, which let a stale file delivered late — or the app's own
   * just-written file re-observed by the watcher — clobber newer local
   * settings. Under strict `>`, a self-re-imported file is a provable no-op:
   * its updatedAt equals the stored row's, so it never re-applies.
   */
  async mergeRow(row) {
    const imported = row as Partial<UserSettings>;
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

  // folders.json lists every folder in one file, so one folder can vanish
  // from it while the file itself stays — same shape as PROJECT_TASKS_KIND.
  async softDeleteRow(id) {
    await softDelete(db.projectFolders, id);
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
