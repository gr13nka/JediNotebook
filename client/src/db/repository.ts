import type { EntityTable } from 'dexie';
import { generateId, getDeviceId } from '../utils/uuid';

/**
 * Repository: the single owner of the persisted-record envelope
 * `{ id, createdAt, updatedAt, deletedAt, deviceId }` and of the soft-delete
 * convention shared by every Dexie table in this app.
 *
 * Every write here goes through the table's normal Dexie `add`/`update` — never
 * a hand-built object or a bypass — so `vault/dexieHooks.ts`'s creating/updating
 * hooks keep firing for sync.
 *
 * What this module deliberately does NOT own: cascading soft-deletes (e.g.
 * deleting a project also soft-deletes its tasks). Those cross-table decisions
 * stay in the entity hook that knows the relationship, documented at the call site.
 */

/** Fields every persisted record carries, stamped by this module alone. */
export interface RecordEnvelope {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

/**
 * Stamps a brand-new record: fresh id, matching created/updated timestamps,
 * `deletedAt: null`, and the current device id. Callers still choose the
 * table and call `add` — this only builds the object.
 */
export function newRecord<T extends object>(fields: T): T & RecordEnvelope {
  const now = new Date().toISOString();
  return {
    ...fields,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: getDeviceId(),
  };
}

/**
 * Stamps `updatedAt: now` onto a patch. Always overwrites any `updatedAt`
 * already on the patch — updatedAt is never caller-supplied, so it can't be
 * forgotten or set stale by accident.
 */
export function stampUpdate<T extends object>(patch: T): T & { updatedAt: string } {
  return { ...patch, updatedAt: new Date().toISOString() };
}

/**
 * Applies `patch` to `id` in `table`, stamping `updatedAt`.
 *
 * `T` is inferred from `table` alone (`NoInfer` on `patch`) — callers
 * routinely pass a patch narrower than the full record (e.g. one field),
 * which would otherwise leave `T` ambiguous between the two argument sites.
 *
 * The `as never` casts below exist only because Dexie's `EntityTable` types
 * its key and its `update()`/`modify()` changes as conditionals
 * (`IDType<T, 'id'>`, `UpdateSpec<InsertType<T, 'id'>>`, which additionally
 * supports dot-path keys we never use) that TypeScript can't resolve against
 * a still-abstract `T`. Every table here keys on a plain string id and is
 * patched with a flat, top-level-keys-only object, so the casts are safe by
 * construction and don't weaken this function's own `id`/`patch` signature.
 */
export async function updateRecord<T extends RecordEnvelope>(
  table: EntityTable<T, 'id'>,
  id: string,
  patch: Partial<NoInfer<T>>,
): Promise<void> {
  await table.update(id as never, stampUpdate(patch) as never);
}

/** Soft-deletes `id` in `table`: stamps `deletedAt` + `updatedAt`. Never a hard delete. */
export async function softDelete<T extends RecordEnvelope>(
  table: EntityTable<T, 'id'>,
  id: string,
): Promise<void> {
  const now = new Date().toISOString();
  await table.update(id as never, { deletedAt: now, updatedAt: now } as never);
}

/** True for a record that hasn't been soft-deleted. Usable directly as a Dexie `.filter()` predicate. */
export function isActive<T extends { deletedAt: string | null }>(record: T): boolean {
  return !record.deletedAt;
}

/** Filters out soft-deleted rows — the `!deletedAt` check every hook used to repeat. */
export function notDeleted<T extends { deletedAt: string | null }>(rows: T[]): T[] {
  return rows.filter(isActive);
}
