import { useLiveQuery } from 'dexie-react-hooks';
import type { EntityTable } from 'dexie';
import { newRecord, notDeleted, softDelete, updateRecord, type RecordEnvelope } from '../db/repository';

interface UseEntityOptions<T> {
  /** Comparator applied after the not-deleted filter. Omit to keep table order. */
  sort?: (a: T, b: T) => number;
}

/**
 * Generic reactive CRUD for a Dexie table whose rows carry the standard
 * record envelope: not-deleted filtering and sorting are applied by
 * construction, and create/update/remove are wired through the repository
 * so every write keeps the envelope and soft-delete rules intact.
 *
 * This is for the "same five lines with the table swapped" case — a flat
 * table, no per-parent queries, no cascades. A hook that needs those stays
 * bespoke and calls the repository primitives directly instead of this hook.
 */
export function useEntity<T extends RecordEnvelope>(
  table: EntityTable<T, 'id'>,
  opts: UseEntityOptions<T> = {},
) {
  const { sort } = opts;

  const items = useLiveQuery(async () => {
    const rows = notDeleted(await table.toArray());
    return sort ? [...rows].sort(sort) : rows;
  }, [table, sort]);

  const create = async (fields: Omit<T, keyof RecordEnvelope>): Promise<T> => {
    const record = newRecord(fields) as T;
    await table.add(record);
    return record;
  };

  const update = (id: string, patch: Partial<T>): Promise<void> => updateRecord(table, id, patch);

  const remove = (id: string): Promise<void> => softDelete(table, id);

  return { items: items ?? [], create, update, remove };
}
