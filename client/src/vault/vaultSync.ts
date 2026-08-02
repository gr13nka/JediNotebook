import { db } from '../db';
import type { VaultBackend } from './vaultBackend';
import { fileIndex } from './fileIndex';
import { VAULT_KINDS, KIND_BY_TABLE, type VaultExportContext } from './vaultKinds';
import { vaultDirs, tableFromPath } from './vaultLayout';
import { recordBase, forgetBase, pruneBases, readBase } from './vaultBase';
import { conflictTargetPath } from './conflictPaths';

const VAULT_VERSION = 1;

// Re-exported for existing callers of `vaultSync.fileIndex` — the singleton
// itself lives in fileIndex.ts so vaultKinds.ts can read it too (to detect
// renames in `gatherWriteSet`) without a circular import between the two.
export { fileIndex };

// ─── Export all data to disk ──────────────────────────────────────

/** One consistent snapshot of every table, handed to each kind's `collectFiles`. */
async function loadExportContext(): Promise<VaultExportContext> {
  const activities = await db.activities.toArray();
  const projects = await db.projects.toArray();
  const projectTasks = await db.projectTasks.toArray();
  const timeEntries = await db.timeEntries.toArray();
  const todayTasks = await db.todayTasks.toArray();
  const inboxItems = await db.inboxItems.toArray();
  const settings = await db.settings.get('default');
  const projectFolders = await db.projectFolders.toArray();
  return { activities, projects, projectTasks, timeEntries, todayTasks, inboxItems, settings, projectFolders };
}

export async function exportAllToDisk(backend: VaultBackend): Promise<void> {
  // Write the vault marker once. Nothing reads its content back, so an
  // `exportedAt` timestamp only made this file differ on every export,
  // manufacturing a Syncthing conflict on every export pair between two
  // devices. Constant content + an exists-guard means existing vaults keep
  // whatever vault.json they already have, untouched.
  if (!(await backend.exists('vault.json'))) {
    await backend.writeFile('vault.json', JSON.stringify({ version: VAULT_VERSION }, null, 2) + '\n');
  }

  // Ensure directories exist
  for (const dir of vaultDirs()) {
    await backend.mkdir(dir);
  }

  const ctx = await loadExportContext();

  const written: string[] = [];
  for (const kind of VAULT_KINDS) {
    for (const file of kind.collectFiles(ctx)) {
      await backend.writeFile(file.path, file.content);
      // What we just wrote is, by definition, the state this device and the
      // vault agree on — the ancestor a later conflict merges against.
      await recordBase(file.path, file.content);
      written.push(file.path);
      if (file.entityId) fileIndex.set(file.entityId, file.path);
    }
  }
  await pruneBases(written);
}

// ─── Import all data from disk ────────────────────────────────────

export async function importAllFromDisk(backend: VaultBackend): Promise<{ total: number; counts: Record<string, number>; errors: string[] }> {
  fileIndex.clear();
  const counts: Record<string, number> = {};
  const errors: string[] = [];
  const seen: string[] = [];

  for (const kind of VAULT_KINDS) {
    const label = kind.layout.table;
    try {
      const paths = await kind.discoverPaths(backend);
      let n = 0;
      for (const path of paths) {
        // Loose prefix/extension matching (discoverPaths) treats a Syncthing
        // conflict copy as an ordinary file of the same kind. Skip it here —
        // one choke point — rather than tightening every kind's matchesPath.
        // resolveConflicts() is what actually folds these in.
        if (conflictTargetPath(path)) continue;
        const content = await backend.readFile(path);
        const parsed = kind.parseFile(path, content);

        // A row present in the last-agreed base but missing from this file is
        // a deletion — the same rule mergeRowSets already applies for a
        // conflict copy, so an ordinary file resolves identically whether or
        // not it happens to arrive as one. Deletion wins over a concurrent
        // local edit (no updatedAt comparison here): Syncthing's own file
        // versioning is the recovery net for that case.
        if (kind.softDeleteRow) {
          const baseRaw = await readBase(path);
          if (baseRaw !== null) {
            try {
              const baseIds = new Set(
                kind.parseFile(path, baseRaw).rows.map(r => r.id as string).filter(Boolean),
              );
              const fileIds = new Set(parsed.rows.map(r => r.id as string));
              for (const id of baseIds) {
                if (!fileIds.has(id)) await kind.softDeleteRow(id);
              }
            } catch {
              // A corrupt stored base must not break import — skip inference
              // for this path. The current file already parsed fine above,
              // so it still imports normally; a real error reading/parsing
              // *it* still falls through to the per-kind catch below.
            }
          }
        }

        for (const row of parsed.rows) {
          await kind.mergeRow(row);
        }
        // Accepting a file's content makes it the agreed state for this path.
        await recordBase(path, content);
        seen.push(path);
        if (parsed.entityId) fileIndex.set(parsed.entityId, path);
        n++;
      }
      counts[label] = n;
    } catch (err) {
      errors.push(`${label}: ${err}`);
    }
  }

  // A kind that errored leaves its unprocessed paths out of `seen` even
  // though their files may be untouched on disk — pruning now would wrongly
  // forget those paths' recorded bases. Skip pruning entirely on any error;
  // it resumes on the next clean run.
  if (errors.length === 0) {
    await pruneBases(seen);
  }

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

// ─── Single entity write (for live sync) ──────────────────────────

export async function writeEntityToDisk(
  backend: VaultBackend,
  entityType: string,
  entityId: string,
): Promise<void> {
  const kind = KIND_BY_TABLE[entityType];
  if (!kind) return;

  const { writes, deletes } = await kind.gatherWriteSet(backend, entityId);

  for (const path of deletes) {
    await backend.deleteFile(path);
    await forgetBase(path);
    fileIndex.removePath(path);
  }
  for (const file of writes) {
    await backend.writeFile(file.path, file.content);
    await recordBase(file.path, file.content);
    if (file.entityId) fileIndex.set(file.entityId, file.path);
  }
}

// ─── Handle external file changes (for Tauri file watcher) ───────

export async function handleExternalChange(
  backend: VaultBackend,
  filePath: string,
  eventType: 'create' | 'modify' | 'delete',
): Promise<void> {
  if (eventType === 'delete') {
    // No explicit conflict-copy guard needed here: a conflict path is never
    // given a fileIndex entry (import and the create/modify branch below
    // both skip it before any `fileIndex.set` call), so `getId` is always
    // undefined for one and the soft-delete block below never runs. Deleting
    // the copy is `resolveConflicts`'s job, not this handler's.
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
    await forgetBase(filePath);
    return;
  }

  // A Syncthing conflict copy delivered mid-session must go through
  // resolveConflicts (three-way merge), never be imported as an ordinary
  // file — see importAllFromDisk's matching guard above.
  if (conflictTargetPath(filePath)) return;

  // create or modify — find the owning kind and re-read + merge
  const kind = VAULT_KINDS.find(k => k.layout.matchesPath(filePath));
  if (!kind) return;

  const content = await backend.readFile(filePath);
  const parsed = kind.parseFile(filePath, content);
  for (const row of parsed.rows) {
    await kind.mergeRow(row);
  }
  await recordBase(filePath, content);
  if (parsed.entityId) fileIndex.set(parsed.entityId, filePath);
}
