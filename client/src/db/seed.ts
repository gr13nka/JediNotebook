import { db } from './index';
import { BREAK_ACTIVITY, DEFAULT_SETTINGS, ACTIVITY_COLORS } from '@shared/constants';
import { generateId, getDeviceId } from '../utils/uuid';
import type { Habit, PomodoroPreset, UserSettings } from '@shared/types';

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

  const existingHabits = await db.habits.count();
  if (existingHabits === 0) {
    const now = new Date().toISOString();
    const deviceId = getDeviceId();
    const defaults: Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'deviceId'>[] = [
      { name: 'Meditate', type: 'boolean', targetValue: 1, unit: '', color: '#D4A017', icon: 'brain', sortOrder: 0, deletedAt: null },
      { name: 'Read', type: 'boolean', targetValue: 1, unit: '', color: '#9B59B6', icon: 'book', sortOrder: 1, deletedAt: null },
      { name: 'Steps', type: 'numeric', targetValue: 10000, unit: 'steps', color: '#4CB85A', icon: 'footprints', sortOrder: 2, deletedAt: null },
      { name: 'Water', type: 'numeric', targetValue: 8, unit: 'glasses', color: '#2E96B0', icon: 'droplet', sortOrder: 3, deletedAt: null },
    ];
    await db.habits.bulkAdd(
      defaults.map((h) => ({
        ...h,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        deviceId,
      })),
    );
  }

  const existingPresets = await db.pomodoroPresets.count();
  if (existingPresets === 0) {
    const now = new Date().toISOString();
    const deviceId = getDeviceId();
    const defaultPresets: Omit<PomodoroPreset, 'id' | 'createdAt' | 'updatedAt' | 'deviceId'>[] = [
      { name: 'Classic', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4, autoStartBreaks: true, autoStartWork: false, isDefault: true, sortOrder: 0, deletedAt: null },
      { name: 'Long Focus', workMinutes: 50, breakMinutes: 10, longBreakMinutes: 30, sessionsBeforeLongBreak: 4, autoStartBreaks: true, autoStartWork: false, isDefault: true, sortOrder: 1, deletedAt: null },
      { name: 'Short Sprint', workMinutes: 15, breakMinutes: 3, longBreakMinutes: 10, sessionsBeforeLongBreak: 4, autoStartBreaks: true, autoStartWork: false, isDefault: true, sortOrder: 2, deletedAt: null },
    ];
    await db.pomodoroPresets.bulkAdd(
      defaultPresets.map((p) => ({
        ...p,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        deviceId,
      })),
    );
  }
}
