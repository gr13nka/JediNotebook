import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { newRecord, notDeleted, softDelete } from '../db/repository';
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
        .toArray()
        .then(notDeleted),
    [targetDate],
  );

  const addManualEntry = async (
    activityId: string,
    durationSeconds: number,
    entryDate?: string,
  ) => {
    const now = new Date().toISOString();
    const logicalDate = entryDate ?? getLogicalDate(dayStartHour);

    await db.timeEntries.add(newRecord({
      activityId,
      startedAt: now,
      endedAt: now,
      durationSeconds,
      isManual: true,
      date: logicalDate,
    }));
  };

  const deleteEntry = (id: string) => softDelete(db.timeEntries, id);

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
