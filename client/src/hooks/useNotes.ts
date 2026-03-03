import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { Note } from '@shared/types';
import { awardXP, XP_VALUES } from '../utils/streak';

export function useNotes() {
  const notes = useLiveQuery(
    () =>
      db.notes
        .filter((n) => !n.deletedAt)
        .toArray()
        .then((arr) =>
          arr.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return b.updatedAt.localeCompare(a.updatedAt);
          }),
        ),
    [],
  );

  const createNote = async (data: {
    title: string;
    content: string;
    color: string;
  }) => {
    const now = new Date().toISOString();
    const note: Note = {
      id: generateId(),
      title: data.title,
      content: data.content,
      color: data.color,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.notes.add(note);
    awardXP(XP_VALUES.createNote);
    return note;
  };

  const updateNote = async (
    id: string,
    patch: Partial<Pick<Note, 'title' | 'content' | 'color'>>,
  ) => {
    await db.notes.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteNote = async (id: string) => {
    const now = new Date().toISOString();
    await db.notes.update(id, {
      deletedAt: now,
      updatedAt: now,
    });
  };

  const togglePin = async (id: string) => {
    const note = await db.notes.get(id);
    if (!note) return;
    await db.notes.update(id, {
      isPinned: !note.isPinned,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    notes: notes ?? [],
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  };
}
