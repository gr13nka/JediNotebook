import { db } from '../db';
import type { VaultBackend } from './vaultBackend';
import { fileIndex } from './fileIndex';
import { VAULT_KINDS, KIND_BY_TABLE, type VaultExportContext } from './vaultKinds';
import { vaultDirs, tableFromPath } from './vaultLayout';

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
  // Write vault marker
  await backend.writeFile('vault.json', JSON.stringify({
    version: VAULT_VERSION,
    exportedAt: new Date().toISOString(),
  }, null, 2) + '\n');

  // Ensure directories exist
  for (const dir of vaultDirs()) {
    await backend.mkdir(dir);
  }

  const ctx = await loadExportContext();

  for (const kind of VAULT_KINDS) {
    for (const file of kind.collectFiles(ctx)) {
      await backend.writeFile(file.path, file.content);
      if (file.entityId) fileIndex.set(file.entityId, file.path);
    }
  }
}

// ─── Import all data from disk ────────────────────────────────────

export async function importAllFromDisk(backend: VaultBackend): Promise<{ total: number; counts: Record<string, number>; errors: string[] }> {
  fileIndex.clear();
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  for (const kind of VAULT_KINDS) {
    const label = kind.layout.table;
    try {
      const paths = await kind.discoverPaths(backend);
      let n = 0;
      for (const path of paths) {
        const content = await backend.readFile(path);
        const parsed = kind.parseFile(path, content);
        for (const row of parsed.rows) {
          await kind.mergeRow(row, 'reconcile');
        }
        if (parsed.entityId) fileIndex.set(parsed.entityId, path);
        n++;
      }
      counts[label] = n;
    } catch (err) {
      errors.push(`${label}: ${err}`);
    }
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
    fileIndex.removePath(path);
  }
  for (const file of writes) {
    await backend.writeFile(file.path, file.content);
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

  // create or modify — find the owning kind and re-read + merge
  const kind = VAULT_KINDS.find(k => k.layout.matchesPath(filePath));
  if (!kind) return;

  const content = await backend.readFile(filePath);
  const parsed = kind.parseFile(filePath, content);
  for (const row of parsed.rows) {
    await kind.mergeRow(row, 'external');
  }
  if (parsed.entityId) fileIndex.set(parsed.entityId, filePath);
}
