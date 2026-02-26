import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { PomodoroPreset } from '@shared/types';

export function usePomodoroPresets() {
  const presets = useLiveQuery(
    () =>
      db.pomodoroPresets
        .filter((p) => !p.deletedAt)
        .sortBy('sortOrder'),
    [],
  );

  const createPreset = async (
    data: Pick<
      PomodoroPreset,
      'name' | 'workMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'sessionsBeforeLongBreak' | 'autoStartBreaks' | 'autoStartWork'
    >,
  ) => {
    const existing = await db.pomodoroPresets.filter((p) => !p.deletedAt).toArray();
    const now = new Date().toISOString();
    await db.pomodoroPresets.add({
      ...data,
      id: generateId(),
      isDefault: false,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
  };

  const updatePreset = async (
    id: string,
    patch: Partial<
      Pick<
        PomodoroPreset,
        'name' | 'workMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'sessionsBeforeLongBreak' | 'autoStartBreaks' | 'autoStartWork'
      >
    >,
  ) => {
    await db.pomodoroPresets.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const deletePreset = async (id: string) => {
    const preset = await db.pomodoroPresets.get(id);
    if (preset?.isDefault) return;
    await db.pomodoroPresets.update(id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    presets: presets ?? [],
    createPreset,
    updatePreset,
    deletePreset,
  };
}
