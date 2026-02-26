import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import { getLogicalDate } from '../utils/time';
import { useSettingsStore } from '../stores/settingsStore';

export function useTimeEntries(date?: string) {
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);
  const targetDate = date ?? getLogicalDate(dayStartHour);

  const entries = useLiveQuery(
    () =>
      db.timeEntries
        .where('date')
        .equals(targetDate)
        .filter((e) => !e.deletedAt)
        .toArray(),
    [targetDate],
  );

  const addManualEntry = async (
    activityId: string,
    durationSeconds: number,
    entryDate?: string,
  ) => {
    const now = new Date().toISOString();
    const logicalDate = entryDate ?? getLogicalDate(dayStartHour);

    await db.timeEntries.add({
      id: generateId(),
      activityId,
      startedAt: now,
      endedAt: now,
      durationSeconds,
      isManual: true,
      date: logicalDate,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
  };

  const deleteEntry = async (id: string) => {
    await db.timeEntries.update(id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const getElapsedForActivity = (activityId: string): number => {
    if (!entries) return 0;
    return entries
      .filter((e) => e.activityId === activityId)
      .reduce((sum, e) => sum + e.durationSeconds, 0);
  };

  return {
    entries: entries ?? [],
    addManualEntry,
    deleteEntry,
    getElapsedForActivity,
  };
}
