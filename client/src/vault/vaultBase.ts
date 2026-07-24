import { db } from '../db';

/**
 * Records what each vault file looked like the last time this device and the
 * vault agreed on it — the common ancestor `threeWayMerge.ts` needs.
 *
 * Every path that is read and accepted, or written out, is recorded here. On
 * the next Syncthing conflict the stored content is the "before" both sides
 * diverged from, which is what makes "the other side deleted this paragraph"
 * distinguishable from "I added this paragraph".
 *
 * Kept device-local (see `VaultBaseEntry`): syncing the base would let the
 * peer overwrite the very snapshot it is being compared against.
 */

/** Remember `content` as the agreed state of `path`. */
export async function recordBase(path: string, content: string): Promise<void> {
  await db.vaultBase.put({ path, content, recordedAt: new Date().toISOString() });
}

/** The agreed content of `path`, or `null` if this device has never recorded one. */
export async function readBase(path: string): Promise<string | null> {
  const entry = await db.vaultBase.get(path);
  return entry ? entry.content : null;
}

/** Drop the base for a path that no longer exists in the vault. */
export async function forgetBase(path: string): Promise<void> {
  await db.vaultBase.delete(path);
}

/**
 * Drop bases for paths the vault no longer contains. Without this the table
 * would grow forever across renames — a project directory carries its name,
 * so every rename strands the old path's base.
 */
export async function pruneBases(livePaths: Iterable<string>): Promise<number> {
  const live = new Set(livePaths);
  const stale = (await db.vaultBase.toCollection().primaryKeys())
    .filter(path => !live.has(path as string)) as string[];
  if (stale.length > 0) await db.vaultBase.bulkDelete(stale);
  return stale.length;
}
