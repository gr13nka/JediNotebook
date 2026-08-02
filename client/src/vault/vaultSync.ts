import { db } from '../db';
import type { VaultBackend } from './vaultBackend';
import { fileIndex } from './fileIndex';
import { VAULT_KINDS, KIND_BY_TABLE, type VaultExportContext, type VaultKind, type ParsedFile } from './vaultKinds';
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

/**
 * A row present in the last-agreed base but missing from this file is a
 * deletion — the same rule `mergeRowSets` already applies for a conflict
 * copy, so an ordinary file resolves identically whether or not it happens
 * to arrive as one. Deletion wins over a concurrent local edit (no
 * updatedAt comparison here): Syncthing's own file versioning is the
 * recovery net for that case.
 *
 * Shared by `importAllFromDisk` and `handleExternalChange` (the file
 * watcher's create/modify path) — whichever one reads a rewritten aggregate
 * file first must apply the same inference before recording the new base,
 * or the evidence a later pass would need to catch up is gone.
 *
 * `idsElsewhere`, when given, is consulted BEFORE the live-Dexie-row
 * `rowBelongsTo` check below and can make the same "moved, not deleted"
 * call from fresher evidence: a batch import already has every file of this
 * kind in hand (see `importAllFromDisk`), so it can tell "this id lives in
 * another file THIS RUN" without trusting Dexie to already reflect a move
 * this device is only now learning about. Lazy (called at most once, only
 * once a candidate deletion is actually found) so a caller for whom
 * computing it means real I/O (the watcher's single-file case, scanning the
 * rest of the kind's files on the backend) doesn't pay that cost on every
 * ordinary edit.
 */
async function applyBaseDiffDeletions(
  kind: VaultKind,
  path: string,
  parsed: ParsedFile,
  idsElsewhere?: () => Promise<Set<string>>,
): Promise<void> {
  if (!kind.softDeleteRow) return;
  const baseRaw = await readBase(path);
  if (baseRaw === null) return;

  // Only base *parsing* is guarded: a corrupt stored base must not break
  // import, and there is nothing to diff against once it fails to parse.
  // The current file already parsed fine above (parseFile succeeded before
  // this call ran), so it still imports normally either way.
  let baseIds: Set<string>;
  try {
    baseIds = new Set(
      kind.parseFile(path, baseRaw).rows.map(r => r.id as string).filter(Boolean),
    );
  } catch {
    return;
  }

  // A softDeleteRow failure, by contrast, must propagate — swallowing it
  // here would let the caller record the new base anyway, permanently
  // discarding the one piece of evidence (the old base) a retry would need
  // to prove the same deletion again.
  const fileIds = new Set(parsed.rows.map(r => r.id as string));
  let elsewhere: Set<string> | null = null;
  for (const id of baseIds) {
    if (fileIds.has(id)) continue;
    if (idsElsewhere) {
      elsewhere ??= await idsElsewhere();
      if (elsewhere.has(id)) continue;
    }
    if (kind.rowBelongsTo) {
      // The id vanished from THIS file, but it may simply have moved to a
      // different file of the same kind (moveTaskToProject, a TimeEntry's
      // date edit) — check where the LIVE row actually is now before
      // treating its absence here as proof it was deleted. No live row at
      // all isn't a "moved" case to protect; fall through and let
      // softDeleteRow's own no-op-on-missing-id behavior handle it.
      const liveRow = await (db as any)[kind.layout.table].get(id);
      if (liveRow && !kind.rowBelongsTo(liveRow, parsed.ownerId)) continue;
    }
    await kind.softDeleteRow(id);
  }
}

/**
 * Every row id found in the kind's OTHER files currently on `backend`
 * (everything `discoverPaths` reports except `excludePath`) — the same
 * "present elsewhere means moved, not deleted" signal `importAllFromDisk`
 * gets for free from its own batch, computed on demand for a caller that
 * only ever sees one file at a time (`handleExternalChange`, the file
 * watcher's per-event path). A broken sibling file doesn't abort the scan —
 * its rows just aren't counted as "elsewhere"; a real parse failure in it
 * surfaces on its own turn through the normal import/reconcile path.
 */
export async function idsInOtherFilesOfKind(
  kind: VaultKind,
  backend: VaultBackend,
  excludePath: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let paths: string[];
  try {
    paths = await kind.discoverPaths(backend);
  } catch {
    return ids;
  }
  for (const path of paths) {
    if (path === excludePath || conflictTargetPath(path)) continue;
    try {
      const content = await backend.readFile(path);
      for (const row of kind.parseFile(path, content).rows) {
        if (typeof row.id === 'string') ids.add(row.id);
      }
    } catch {
      // Skip it — see doc comment above.
    }
  }
  return ids;
}

export async function importAllFromDisk(backend: VaultBackend): Promise<{ total: number; counts: Record<string, number>; errors: string[] }> {
  fileIndex.clear();
  const counts: Record<string, number> = {};
  const errors: string[] = [];
  const seen: string[] = [];

  for (const kind of VAULT_KINDS) {
    const label = kind.layout.table;
    try {
      const paths = await kind.discoverPaths(backend);

      // Phase 1: read, parse, and merge EVERY path of this kind before any
      // one path's deletion inference runs. A base-diff scoped to a single
      // path can't tell "genuinely deleted" from "moved to a file this same
      // run also happens to touch" (moveTaskToProject relocates a task to a
      // DIFFERENT project's tasks.md) — reading everything up front means
      // the full set of ids this run actually saw is known before any path
      // decides an absence means a deletion, instead of that decision
      // depending on which path happens to sort first.
      const entries: { path: string; content: string; parsed: ParsedFile }[] = [];
      const idsInBatch = new Set<string>();
      for (const path of paths) {
        // Loose prefix/extension matching (discoverPaths) treats a Syncthing
        // conflict copy as an ordinary file of the same kind. Skip it here —
        // one choke point — rather than tightening every kind's matchesPath.
        // resolveConflicts() is what actually folds these in.
        if (conflictTargetPath(path)) continue;
        const content = await backend.readFile(path);
        const parsed = kind.parseFile(path, content);
        entries.push({ path, content, parsed });
        for (const row of parsed.rows) {
          if (typeof row.id === 'string') idsInBatch.add(row.id);
          await kind.mergeRow(row);
        }
      }

      // Phase 2: the whole batch is merged and its id union known, so each
      // path can now safely decide its own deletions and hand its content
      // over as the new agreed base.
      let n = 0;
      for (const { path, content, parsed } of entries) {
        const idsElsewhere = new Set(idsInBatch);
        for (const row of parsed.rows) {
          if (typeof row.id === 'string') idsElsewhere.delete(row.id);
        }
        await applyBaseDiffDeletions(kind, path, parsed, async () => idsElsewhere);
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

  // A row a peer removed from this aggregate file arrives here exactly like
  // it does during a whole-vault import — as a MODIFY with the row simply
  // absent — so it needs the identical base-diff inference before the new
  // base is recorded, or the deletion is never applied and the evidence to
  // catch it later (the old base) is gone the moment recordBase runs below.
  //
  // Unlike importAllFromDisk, this handler only ever sees ONE file — it has
  // no batch-wide id union to consult for free. `idsInOtherFilesOfKind`
  // recovers the same signal on demand, straight off the backend's CURRENT
  // disk state: a cross-file move's destination file is typically already
  // written by the time either side's watcher event fires (Syncthing/the
  // filesystem doesn't wait for this device to have processed one event
  // before delivering the next), so this closes the same race
  // importAllFromDisk's batch view closes, for the common case. It cannot
  // close it completely — see docs/vault-conflict-resolution.md for the
  // residual window this doesn't cover.
  await applyBaseDiffDeletions(
    kind, filePath, parsed,
    () => idsInOtherFilesOfKind(kind, backend, filePath),
  );

  for (const row of parsed.rows) {
    await kind.mergeRow(row);
  }
  await recordBase(filePath, content);
  if (parsed.entityId) fileIndex.set(parsed.entityId, filePath);
}
