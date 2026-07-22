import { db } from '../db';
import { useEntity } from './useEntity';
import { updateRecord } from '../db/repository';
import type { InboxItem } from '@shared/types';

const byCreatedAtDesc = (a: InboxItem, b: InboxItem) => b.createdAt.localeCompare(a.createdAt);

export function useInbox() {
  const { items, create, update, remove } = useEntity<InboxItem>(db.inboxItems, {
    sort: byCreatedAtDesc,
  });

  const addItem = (text: string) => create({ text });

  const updateItem = (id: string, text: string) => update(id, { text });

  const deleteItem = (id: string) => remove(id);

  // Deliberate un-delete for the Sort mode "Undo" action: clears deletedAt
  // (re-stamping updatedAt) instead of the recreate-a-new-record path other
  // features use, so the item's id and createdAt survive the undo window.
  const restoreItem = (id: string) => updateRecord(db.inboxItems, id, { deletedAt: null });

  return {
    items,
    addItem,
    updateItem,
    deleteItem,
    restoreItem,
  };
}
