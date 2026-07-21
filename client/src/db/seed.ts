import { db } from './index';
import { BREAK_ACTIVITY, DEFAULT_SETTINGS, ACTIVITY_COLORS } from '@shared/constants';
import { generateId, getDeviceId } from '../utils/uuid';
import type { UserSettings } from '@shared/types';

export async function seedDatabase() {
  const existingBreak = await db.activities
    .filter((a) => a.isBreak)
    .first();

  if (!existingBreak) {
    const now = new Date().toISOString();
    await db.activities.add({
      id: generateId(),
      name: BREAK_ACTIVITY.name,
      color: ACTIVITY_COLORS[1], // green for break
      dailyBudgetMinutes: BREAK_ACTIVITY.dailyBudgetMinutes,
      isBreak: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
  }

  const existingSettings = await db.settings.get('default');
  if (!existingSettings) {
    const now = new Date().toISOString();
    await db.settings.add({
      id: 'default',
      ...DEFAULT_SETTINGS,
      updatedAt: now,
      deviceId: getDeviceId(),
    });
  }
}
