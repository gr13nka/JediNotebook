import type Dexie from 'dexie';
import { writeQueue } from './writeQueue';
import { writeGuard } from './writeGuard';

/** Table name → vault entity type mapping */
const TABLE_TO_TYPE: Record<string, string> = {
  activities: 'activities',
  timeEntries: 'timeEntries',
  settings: 'settings',
  projects: 'projects',
  projectTasks: 'projectTasks',
  todayTasks: 'todayTasks',
  projectFolders: 'projectFolders',
  inboxItems: 'inboxItems',
};

/**
 * Register Dexie hooks on all tables to intercept creates/updates/deletes
 * and queue vault file writes.
 *
 * Call once after db is created and vault is enabled.
 */
export function registerVaultMiddleware(db: Dexie): () => void {
  const unsubscribers: (() => void)[] = [];

  for (const [tableName, entityType] of Object.entries(TABLE_TO_TYPE)) {
    const table = (db as any)[tableName];
    if (!table) continue;

    // Creating hook
    const onCreating = function (this: any, primKey: any, obj: any) {
      // Queue a write after the transaction completes
      setTimeout(() => {
        writeQueue.enqueue(entityType, obj.id ?? primKey);
      }, 0);
    };

    // Updating hook
    const onUpdating = function (this: any, modifications: any, primKey: any, obj: any) {
      setTimeout(() => {
        writeQueue.enqueue(entityType, primKey);
      }, 0);
    };

    table.hook('creating').subscribe(onCreating);
    table.hook('updating').subscribe(onUpdating);

    unsubscribers.push(() => {
      table.hook('creating').unsubscribe(onCreating);
      table.hook('updating').unsubscribe(onUpdating);
    });
  }

  return () => {
    for (const unsub of unsubscribers) unsub();
  };
}
