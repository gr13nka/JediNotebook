import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import { getNextColor } from '../utils/colors';
import type { Activity } from '@shared/types';

export function useActivities() {
  const activities = useLiveQuery(
    () =>
      db.activities
        .filter((a) => !a.deletedAt)
        .sortBy('sortOrder'),
    [],
  );

  const createActivity = async (name: string, dailyBudgetMinutes: number, color?: string) => {
    const existing = await db.activities.filter((a) => !a.deletedAt).toArray();
    const usedColors = existing.map((a) => a.color);
    const now = new Date().toISOString();

    await db.activities.add({
      id: generateId(),
      name,
      color: color || getNextColor(usedColors),
      dailyBudgetMinutes,
      isBreak: false,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
  };

  const updateActivity = async (
    id: string,
    patch: Partial<Pick<Activity, 'name' | 'dailyBudgetMinutes' | 'sortOrder' | 'color'>>,
  ) => {
    await db.activities.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteActivity = async (id: string) => {
    await db.activities.update(id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    activities: activities ?? [],
    createActivity,
    updateActivity,
    deleteActivity,
  };
}
