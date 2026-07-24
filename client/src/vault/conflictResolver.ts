import type { VaultBackend } from './vaultBackend';
import { VAULT_KINDS, type VaultKind } from './vaultKinds';
import { mergeRowSets, mergeTextBodies } from './threeWayMerge';
import { readBase, recordBase, forgetBase } from './vaultBase';
import { writeEntityToDisk } from './vaultSync';

/**
 * Folds Syncthing conflict copies back into the file they came from.
 *
 * Syncthing cannot merge; when two devices edit one file while disconnected
 * it keeps the loser as `<stem>.sync-conflict-<date>-<time>-<device><ext>`
 * and moves on. Left alone those copies accumulate and the losing side's
 * edits are never seen again — the app reads only the main file.
 *
 * This module reads both sides, merges them three-way against the recorded
 * base (`vaultBase.ts`), writes the result through the normal Dexie merge
 * path, and deletes the conflict copy. Deletions are honoured rather than
 * undone: a row or paragraph only disappears if the base proves it existed
 * before one side removed it.
 */

/**
 * `project.sync-conflict-20260724-153258-YZWMYOO.md` -> stem `project`, ext `.md`.
 * The device suffix is Syncthing's short device ID; the timestamp is local to
 * whichever device detected the conflict, so neither is used for ordering —
 * `updatedAt` inside the file is the only ordering signal trusted here.
 */
const CONFLICT_NAME = /^(.+)\.sync-conflict-\d{8}-\d{6}-[A-Z0-9]+(\.[^./]+)$/;

/** The path a conflict copy belongs to, or `null` if `path` is not one. */
export function conflictTargetPath(path: string): string | null {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const match = CONFLICT_NAME.exec(path.slice(slash + 1));
  return match ? `${dir}${match[1]}${match[2]}` : null;
}

export interface ConflictResolution {
  /** The conflict copy that was processed. */
  conflictPath: string;
  /** The file it was merged into. */
  targetPath: string;
  resolved: boolean;
  /** Rows or paragraphs adopted from the conflict copy. */
  added: number;
  /** Rows or paragraphs dropped because one side deleted them since the base. */
  removed: number;
  /** No base was recorded, so both sides were unioned instead of diffed. */
  unionFallback: boolean;
  error?: string;
}

/**
 * Every directory that could hold a conflict copy for this kind. A singleton
 * lives at the vault root (`''`) rather than under a directory of its own, so
 * its own path supplies the location instead.
 */
async function conflictDirs(kind: VaultKind, backend: VaultBackend): Promise<string[]> {
  const layout = kind.layout as { dir?: string; path?: string };
  const dirs = new Set<string>();
  if (layout.dir !== undefined) dirs.add(layout.dir);
  if (layout.path !== undefined) {
    const slash = layout.path.lastIndexOf('/');
    dirs.add(slash === -1 ? '' : layout.path.slice(0, slash));
  }
  for (const path of await kind.discoverPaths(backend)) {
    const slash = path.lastIndexOf('/');
    if (slash !== -1) dirs.add(path.slice(0, slash));
  }
  return [...dirs];
}

export interface MergePlan {
  /** Rows to persist, with merged text fields and timestamps already applied. */
  rows: any[];
  /** Ids the merge proved deleted on one side. */
  deletedIds: string[];
  added: number;
  removed: number;
  unionFallback: boolean;
}

/**
 * Decide what a conflict merge should persist. Pure — no Dexie, no backend —
 * so the decision that actually ships can be tested directly.
 *
 * The `updatedAt` bump is the load-bearing part. `mergeEntity` only writes on
 * a strict `incoming.updatedAt > existing.updatedAt`, and the target file was
 * serialized from this device's own row, so its timestamp *equals* the stored
 * one. Without the bump, every conflict our side wins would compute a correct
 * merged body and then silently fail to store it — and the conflict copy is
 * deleted right after, so the other side's text would be gone for good.
 * Advancing the timestamp also carries the merge out to the other devices,
 * which is what lets them converge rather than resend their half forever.
 */
export function planMerge(
  textField: string | undefined,
  baseRows: any[] | null,
  ourRows: any[],
  theirRows: any[],
): MergePlan {
  const merged = mergeRowSets(baseRows as any, ourRows as any, theirRows as any);
  let removed = merged.deletedIds.length;
  let added = merged.added;

  const ourById = new Map(ourRows.map(r => [r.id, r]));
  const theirById = new Map(theirRows.map(r => [r.id, r]));
  const baseById = new Map((baseRows ?? []).map(r => [r.id, r]));

  const rows = (merged.rows as any[]).map(row => {
    if (!textField) return row;
    const ours = ourById.get(row.id);
    const theirs = theirById.get(row.id);
    if (!ours || !theirs) return row;

    const text = mergeTextBodies(
      baseRows === null ? null : (baseById.get(row.id)?.[textField] ?? null),
      String(ours[textField] ?? ''),
      String(theirs[textField] ?? ''),
    );
    added += text.added;
    removed += text.removed;

    const next = { ...row, [textField]: text.body };
    // Merged prose exists on neither side, so it must outrank both. See the
    // doc comment above for why equality here would lose the merge outright.
    // (Distinct from the spurious `Date.now()` stamping removed from
    // `serializeProjectTasksFile` — this content genuinely changed.)
    if (text.body !== String(row[textField] ?? '')) {
      next.updatedAt = new Date().toISOString();
    }
    return next;
  });

  return { rows, deletedIds: merged.deletedIds, added, removed, unionFallback: merged.unionFallback };
}

async function readIfPresent(backend: VaultBackend, path: string): Promise<string | null> {
  try {
    return (await backend.exists(path)) ? await backend.readFile(path) : null;
  } catch {
    return null;
  }
}

/**
 * Merge one conflict copy into its target.
 *
 * Rows are keyed by id and reconciled by `updatedAt` — the same rule an
 * ordinary sync applies — so a conflict copy can never resolve differently
 * than the file would have if it had arrived without conflicting. A kind
 * that declares `textField` additionally merges that field paragraph-wise
 * for rows present on both sides, because last-write-wins on a note body
 * discards the loser's writing wholesale.
 */
async function resolveOne(
  backend: VaultBackend,
  kind: VaultKind,
  conflictPath: string,
  targetPath: string,
): Promise<ConflictResolution> {
  const base: ConflictResolution = {
    conflictPath, targetPath, resolved: false, added: 0, removed: 0, unionFallback: false,
  };

  const theirsRaw = await readIfPresent(backend, conflictPath);
  if (theirsRaw === null) return { ...base, error: 'conflict copy unreadable' };

  const oursRaw = await readIfPresent(backend, targetPath);
  const baseRaw = await readBase(targetPath);

  const parse = (content: string) => kind.parseFile(targetPath, content).rows as any[];

  let ourRows: any[] = [];
  let theirRows: any[] = [];
  let baseRows: any[] | null = null;
  try {
    theirRows = parse(theirsRaw);
    ourRows = oursRaw === null ? [] : parse(oursRaw);
    baseRows = baseRaw === null ? null : parse(baseRaw);
  } catch (err) {
    return { ...base, error: `parse failed: ${err}` };
  }

  // Rows without an `id` (a singleton file such as settings.json) have no key
  // to merge on; last-write-wins via the kind's own mergeRow is all that is
  // available, so hand them straight over.
  const keyed = theirRows.every(r => typeof r?.id === 'string');
  if (!keyed) {
    for (const row of theirRows) await kind.mergeRow(row, 'reconcile');
    await backend.deleteFile(conflictPath);
    return { ...base, resolved: true };
  }

  const plan = planMerge(kind.textField, baseRows, ourRows, theirRows);
  const { added, removed } = plan;

  for (const row of plan.rows) {
    await kind.mergeRow(row, 'reconcile');
  }

  // Rows the merge proved deleted are soft-deleted through the kind's own
  // table, keeping the `deletedAt` convention rather than hard-removing.
  for (const id of plan.deletedIds) {
    await kind.softDeleteRow?.(id);
  }

  await backend.deleteFile(conflictPath);

  // Re-serialize so the merged result reaches disk immediately. Only
  // entity-scoped kinds can address a single file this way; for the rest
  // Dexie now holds the merged truth and the next export writes it out.
  const entityId = kind.parseFile(targetPath, theirsRaw).entityId;
  if (entityId) {
    try {
      await writeEntityToDisk(backend, kind.layout.table, entityId);
      const written = await readIfPresent(backend, targetPath);
      if (written !== null) await recordBase(targetPath, written);
    } catch (err) {
      return { ...base, resolved: true, added, removed, unionFallback: plan.unionFallback, error: `rewrite failed: ${err}` };
    }
  }

  return { ...base, resolved: true, added, removed, unionFallback: plan.unionFallback };
}

/**
 * Scan the whole vault for conflict copies and merge each into its target.
 *
 * Safe to run repeatedly: a copy is deleted only after its content has been
 * merged into Dexie, so an interrupted run leaves the remaining copies for
 * the next pass rather than losing them.
 */
export async function resolveConflicts(backend: VaultBackend): Promise<ConflictResolution[]> {
  const results: ConflictResolution[] = [];

  for (const kind of VAULT_KINDS) {
    let dirs: string[];
    try {
      dirs = await conflictDirs(kind, backend);
    } catch {
      continue;
    }

    for (const dir of dirs) {
      let entries: string[];
      try {
        entries = await backend.listFiles(dir);
      } catch {
        continue;
      }

      for (const path of entries) {
        const targetPath = conflictTargetPath(path);
        if (!targetPath) continue;
        if (!kind.layout.matchesPath(targetPath)) continue;

        try {
          results.push(await resolveOne(backend, kind, path, targetPath));
        } catch (err) {
          results.push({
            conflictPath: path, targetPath, resolved: false,
            added: 0, removed: 0, unionFallback: false, error: String(err),
          });
        }
      }
    }
  }

  for (const r of results) {
    if (!r.resolved) await forgetBase(r.targetPath).catch(() => {});
  }

  const merged = results.filter(r => r.resolved).length;
  if (results.length > 0) {
    console.log(`[vault] conflicts: merged ${merged}/${results.length}`, results);
  }
  return results;
}
