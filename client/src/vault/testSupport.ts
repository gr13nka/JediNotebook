// Vitest runs in `environment: 'node'` (see client/vitest.config.ts), which
// has no IndexedDB. This import must run before `../db` is evaluated
// anywhere, because that module reads `globalThis.indexedDB` at module load
// time to construct the Dexie instance.
import 'fake-indexeddb/auto';

import { db } from '../db';
import { fileIndex } from './fileIndex';

/**
 * Resets state between tests. Clears every Dexie table in place rather than
 * `db.delete()` + `db.open()` — re-running all 17 schema migrations per test
 * would be needlessly slow.
 */
export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map(table => table.clear()));
  fileIndex.clear();
}
