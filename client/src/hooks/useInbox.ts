import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { InboxItem } from '@shared/types';

export function useInbox() {
  const items = useLiveQuery(
    () =>
      db.inboxItems
        .filter((item) => !item.deletedAt)
        .toArray()
        .then((arr) => arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    [],
  );

  const addItem = async (text: string) => {
    const now = new Date().toISOString();
    const item: InboxItem = {
      id: generateId(),
      text,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.inboxItems.add(item);
    return item;
  };

  const updateItem = async (id: string, text: string) => {
    await db.inboxItems.update(id, {
      text,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteItem = async (id: string) => {
    const now = new Date().toISOString();
    await db.inboxItems.update(id, {
      deletedAt: now,
      updatedAt: now,
    });
  };

  return {
    items: items ?? [],
    addItem,
    updateItem,
    deleteItem,
  };
}
