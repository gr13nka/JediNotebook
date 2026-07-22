import { db } from '../db';
import { notDeleted } from '../db/repository';
import { useEntity } from './useEntity';
import { getNextColor } from '../utils/colors';
import type { Activity } from '@shared/types';

const bySortOrder = (a: Activity, b: Activity) => a.sortOrder - b.sortOrder;

export function useActivities() {
  const { items: activities, create, update, remove } = useEntity<Activity>(db.activities, {
    sort: bySortOrder,
  });

  const createActivity = async (name: string, dailyBudgetMinutes: number, color?: string) => {
    const existing = notDeleted(await db.activities.toArray());
    const usedColors = existing.map((a) => a.color);

    await create({
      name,
      color: color || getNextColor(usedColors),
      dailyBudgetMinutes,
      isBreak: false,
      sortOrder: existing.length,
    });
  };

  const updateActivity = (
    id: string,
    patch: Partial<Pick<Activity, 'name' | 'dailyBudgetMinutes' | 'sortOrder' | 'color'>>,
  ) => update(id, patch);

  const deleteActivity = (id: string) => remove(id);

  return {
    activities,
    createActivity,
    updateActivity,
    deleteActivity,
  };
}
