import { entityFilename } from './sanitize';

/**
 * Single owner of vault *layout* decisions: which directory an entity kind
 * lives in, how its file/directory name is built, which Dexie table it maps
 * to, and how to recognize its files when scanning a vault or handling an
 * external file-change event.
 *
 * Before this module existed, that knowledge (dir names, filename shapes,
 * path-prefix checks) was duplicated across serializers.ts, vaultSync.ts
 * (export/import/write/external-change) and dexieHooks.ts — seven
 * independent places that had to be kept in sync by hand. Every one of those
 * now asks a `VaultLayoutEntry` instead of hardcoding a path.
 *
 * What this module does NOT own:
 *  - Filename *encoding* (sanitizing a name, appending a short id) — that's
 *    sanitize.ts's `entityFilename()`, reused here.
 *  - Frontmatter/JSON serialization of entity fields — that's serializers.ts.
 *  - What happens when a file is read/written/merged — that's vaultSync.ts.
 *
 * Four shapes cover every entity kind currently synced:
 *  - `perEntityFile`: one file per entity, named from the entity itself,
 *    living directly inside a directory (e.g. activities).
 *  - `perEntityDir`: one *fixed-name* file living inside a per-entity
 *    directory (e.g. projects/<Name (id)>/project.md). Two tables
 *    (`projects`, `projectTasks`) share the same directory-naming scheme but
 *    own different files within it, so they are two entries with the same
 *    `dir` and `buildDirPath`.
 *  - `perDateFile`: one file per calendar date, named from the date itself
 *    (time log, today tasks).
 *  - `singleton`: exactly one fixed top-level path for the whole vault
 *    (inbox, settings, folders).
 */

interface PerEntityFileEntry {
  kind: 'perEntityFile';
  table: string;
  dir: string;
  fileExtension: string;
  /** Build the vault-relative path for one entity's file. */
  buildPath(name: string, id: string): string;
  /** Does this path belong to this entity kind? */
  matchesPath(path: string): boolean;
}

interface PerEntityDirEntry {
  kind: 'perEntityDir';
  table: string;
  dir: string;
  /** Fixed filename this table owns within each entity's directory. */
  fileName: string;
  /** Build the vault-relative directory path for one entity. */
  buildDirPath(name: string, id: string): string;
  /** Build the vault-relative path to this table's file for one entity. */
  buildPath(name: string, id: string): string;
  /** Does this path belong to this table's file? */
  matchesPath(path: string): boolean;
}

interface PerDateFileEntry {
  kind: 'perDateFile';
  table: string;
  dir: string;
  fileExtension: string;
  /** Build the vault-relative path for one date's aggregate file. */
  buildPath(date: string): string;
  /** Does this path belong to this per-date kind? */
  matchesPath(path: string): boolean;
}

interface SingletonEntry {
  kind: 'singleton';
  table: string;
  /** The one fixed vault-relative path for this kind. */
  path: string;
  matchesPath(path: string): boolean;
}

export type VaultLayoutEntry =
  | PerEntityFileEntry
  | PerEntityDirEntry
  | PerDateFileEntry
  | SingletonEntry;

// ─── Shared directory-naming for the "projects" family ────────────

const PROJECTS_DIR = 'projects';

function buildProjectDirPath(name: string, id: string): string {
  return `${PROJECTS_DIR}/${entityFilename(name, id)}`;
}

// ─── Entries ────────────────────────────────────────────────────────

export const ACTIVITIES: PerEntityFileEntry = {
  kind: 'perEntityFile',
  table: 'activities',
  dir: 'activities',
  fileExtension: '.md',
  buildPath: (name, id) => `activities/${entityFilename(name, id)}.md`,
  matchesPath: path => path.startsWith('activities/'),
};

export const PROJECTS: PerEntityDirEntry = {
  kind: 'perEntityDir',
  table: 'projects',
  dir: PROJECTS_DIR,
  fileName: 'project.md',
  buildDirPath: buildProjectDirPath,
  buildPath: (name, id) => `${buildProjectDirPath(name, id)}/project.md`,
  matchesPath: path => /^projects\/[^/]+\/project\.md$/.test(path),
};

export const PROJECT_TASKS: PerEntityDirEntry = {
  kind: 'perEntityDir',
  table: 'projectTasks',
  dir: PROJECTS_DIR,
  fileName: 'tasks.md',
  buildDirPath: buildProjectDirPath,
  buildPath: (name, id) => `${buildProjectDirPath(name, id)}/tasks.md`,
  matchesPath: path => /^projects\/[^/]+\/tasks\.md$/.test(path),
};

export const TIME_LOG: PerDateFileEntry = {
  kind: 'perDateFile',
  table: 'timeEntries',
  dir: 'time-log',
  fileExtension: '.md',
  buildPath: date => `time-log/${date}.md`,
  matchesPath: path => path.startsWith('time-log/'),
};

export const TODAY: PerDateFileEntry = {
  kind: 'perDateFile',
  table: 'todayTasks',
  dir: 'today',
  fileExtension: '.md',
  buildPath: date => `today/${date}.md`,
  matchesPath: path => path.startsWith('today/'),
};

export const INBOX: SingletonEntry = {
  kind: 'singleton',
  table: 'inboxItems',
  path: 'inbox.md',
  matchesPath: path => path === 'inbox.md',
};

export const SETTINGS: SingletonEntry = {
  kind: 'singleton',
  table: 'settings',
  path: 'settings.json',
  matchesPath: path => path === 'settings.json',
};

export const FOLDERS: SingletonEntry = {
  kind: 'singleton',
  table: 'projectFolders',
  path: 'folders.json',
  matchesPath: path => path === 'folders.json',
};

/** Every entity kind synced to the vault, in export/scan order. */
export const VAULT_LAYOUT: VaultLayoutEntry[] = [
  ACTIVITIES, PROJECTS, PROJECT_TASKS, TIME_LOG, TODAY, INBOX, SETTINGS, FOLDERS,
];

// ─── Derived queries ────────────────────────────────────────────────

/** Directories that must exist before any entity file can be written into them. */
export function vaultDirs(): string[] {
  const dirs = new Set<string>();
  for (const entry of VAULT_LAYOUT) {
    if (entry.kind !== 'singleton') dirs.add(entry.dir);
  }
  return [...dirs];
}

/** Resolve which Dexie table owns a vault-relative path, or null if none do. */
export function tableFromPath(path: string): string | null {
  for (const entry of VAULT_LAYOUT) {
    if (entry.matchesPath(path)) return entry.table;
  }
  return null;
}

/**
 * Dexie table name -> vault entity type string (the key `writeEntityToDisk`
 * switches on). Currently every table maps to itself; kept as an explicit
 * derived map so callers don't assume that identity.
 */
export const TABLE_TO_TYPE: Record<string, string> = Object.fromEntries(
  VAULT_LAYOUT.map(entry => [entry.table, entry.table]),
);
