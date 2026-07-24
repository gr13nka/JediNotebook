import { db } from './index';
import { BREAK_ACTIVITY, DEFAULT_DEVICE_SETTINGS, DEFAULT_SETTINGS, ACTIVITY_COLORS } from '@shared/constants';
import { newRecord } from './repository';

export async function seedDatabase() {
  const existingBreak = await db.activities
    .filter((a) => a.isBreak)
    .first();

  if (!existingBreak) {
    await db.activities.add(newRecord({
      name: BREAK_ACTIVITY.name,
      color: ACTIVITY_COLORS[1], // green for break
      dailyBudgetMinutes: BREAK_ACTIVITY.dailyBudgetMinutes,
      isBreak: true,
      sortOrder: 0,
    }));
  }

  const existingSettings = await db.settings.get('default');
  if (!existingSettings) {
    // The settings row is a fixed-id singleton, not a soft-deletable envelope
    // record, so it only borrows `updatedAt`/`deviceId` from `newRecord` — the
    // `id`/`createdAt`/`deletedAt` it also stamps don't apply here and are discarded.
    const { updatedAt, deviceId } = newRecord({});
    await db.settings.add({
      id: 'default',
      ...DEFAULT_SETTINGS,
      updatedAt,
      deviceId,
    });
  }

  const existingDeviceSettings = await db.deviceSettings.get('default');
  if (!existingDeviceSettings) {
    await db.deviceSettings.add({ id: 'default', ...DEFAULT_DEVICE_SETTINGS });
  }
}
