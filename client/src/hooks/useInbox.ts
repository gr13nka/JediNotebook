import { db } from '../db';
import { useEntity } from './useEntity';
import type { InboxItem } from '@shared/types';

const byCreatedAtDesc = (a: InboxItem, b: InboxItem) => b.createdAt.localeCompare(a.createdAt);

export function useInbox() {
  const { items, create, update, remove } = useEntity<InboxItem>(db.inboxItems, {
    sort: byCreatedAtDesc,
  });

  const addItem = (text: string) => create({ text });

  const updateItem = (id: string, text: string) => update(id, { text });

  const deleteItem = (id: string) => remove(id);

  return {
    items,
    addItem,
    updateItem,
    deleteItem,
  };
}
