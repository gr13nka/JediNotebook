import { getDb } from '../database.js';
import type { Activity, TimeEntry, UserSettings, SyncPayload, SyncResponse } from '../../../shared/types';

export function getChangesSince(since: string): SyncResponse {
  const db = getDb();

  const activities = db
    .prepare('SELECT * FROM activities WHERE updatedAt > ?')
    .all(since) as Activity[];

  const timeEntries = db
    .prepare('SELECT * FROM time_entries WHERE updatedAt > ?')
    .all(since) as any[];

  const settingsRow = db
    .prepare('SELECT * FROM user_settings WHERE updatedAt > ? LIMIT 1')
    .get(since) as any | undefined;

  // Convert SQLite booleans to JS booleans for activities
  const mappedActivities = activities.map((a: any) => ({
    ...a,
    isBreak: Boolean(a.isBreak),
  }));

  // Convert SQLite booleans for time entries
  const mappedEntries = timeEntries.map((e: any) => ({
    ...e,
    isManual: Boolean(e.isManual),
  }));

  let settings: UserSettings | null = null;
  if (settingsRow) {
    settings = {
      ...settingsRow,
      syncEnabled: Boolean(settingsRow.syncEnabled),
    };
  }

  return {
    activities: mappedActivities,
    timeEntries: mappedEntries,
    settings,
    serverTime: new Date().toISOString(),
  };
}

export function applyChanges(payload: SyncPayload): void {
  const db = getDb();

  const upsertActivity = db.prepare(`
    INSERT INTO activities (id, name, color, dailyBudgetMinutes, isBreak, sortOrder, createdAt, updatedAt, deletedAt, deviceId)
    VALUES (@id, @name, @color, @dailyBudgetMinutes, @isBreak, @sortOrder, @createdAt, @updatedAt, @deletedAt, @deviceId)
    ON CONFLICT(id) DO UPDATE SET
      name = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.name ELSE activities.name END,
      color = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.color ELSE activities.color END,
      dailyBudgetMinutes = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.dailyBudgetMinutes ELSE activities.dailyBudgetMinutes END,
      isBreak = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.isBreak ELSE activities.isBreak END,
      sortOrder = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.sortOrder ELSE activities.sortOrder END,
      updatedAt = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.updatedAt ELSE activities.updatedAt END,
      deletedAt = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.deletedAt ELSE activities.deletedAt END,
      deviceId = CASE WHEN excluded.updatedAt > activities.updatedAt THEN excluded.deviceId ELSE activities.deviceId END
  `);

  const upsertEntry = db.prepare(`
    INSERT INTO time_entries (id, activityId, startedAt, endedAt, durationSeconds, isManual, date, createdAt, updatedAt, deletedAt, deviceId)
    VALUES (@id, @activityId, @startedAt, @endedAt, @durationSeconds, @isManual, @date, @createdAt, @updatedAt, @deletedAt, @deviceId)
    ON CONFLICT(id) DO UPDATE SET
      activityId = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.activityId ELSE time_entries.activityId END,
      startedAt = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.startedAt ELSE time_entries.startedAt END,
      endedAt = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.endedAt ELSE time_entries.endedAt END,
      durationSeconds = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.durationSeconds ELSE time_entries.durationSeconds END,
      isManual = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.isManual ELSE time_entries.isManual END,
      date = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.date ELSE time_entries.date END,
      updatedAt = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.updatedAt ELSE time_entries.updatedAt END,
      deletedAt = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.deletedAt ELSE time_entries.deletedAt END,
      deviceId = CASE WHEN excluded.updatedAt > time_entries.updatedAt THEN excluded.deviceId ELSE time_entries.deviceId END
  `);

  const upsertSettings = db.prepare(`
    INSERT INTO user_settings (id, dayStartHour, dayEndHour, timezone, barStyle, syncEnabled, syncServerUrl, syncApiKey, updatedAt, deviceId)
    VALUES (@id, @dayStartHour, @dayEndHour, @timezone, @barStyle, @syncEnabled, @syncServerUrl, @syncApiKey, @updatedAt, @deviceId)
    ON CONFLICT(id) DO UPDATE SET
      dayStartHour = CASE WHEN excluded.updatedAt > user_settings.updatedAt THEN excluded.dayStartHour ELSE user_settings.dayStartHour END,
      dayEndHour = CASE WHEN excluded.updatedAt > user_settings.updatedAt THEN excluded.dayEndHour ELSE user_settings.dayEndHour END,
      timezone = CASE WHEN excluded.updatedAt > user_settings.updatedAt THEN excluded.timezone ELSE user_settings.timezone END,
      barStyle = CASE WHEN excluded.updatedAt > user_settings.updatedAt THEN excluded.barStyle ELSE user_settings.barStyle END,
      updatedAt = CASE WHEN excluded.updatedAt > user_settings.updatedAt THEN excluded.updatedAt ELSE user_settings.updatedAt END,
      deviceId = CASE WHEN excluded.updatedAt > user_settings.updatedAt THEN excluded.deviceId ELSE user_settings.deviceId END
  `);

  const applyAll = db.transaction(() => {
    for (const a of payload.activities) {
      upsertActivity.run({
        ...a,
        isBreak: a.isBreak ? 1 : 0,
      });
    }
    for (const e of payload.timeEntries) {
      upsertEntry.run({
        ...e,
        isManual: e.isManual ? 1 : 0,
      });
    }
    if (payload.settings) {
      upsertSettings.run({
        ...payload.settings,
        id: payload.settings.id || 'default',
        syncEnabled: payload.settings.syncEnabled ? 1 : 0,
      });
    }
  });

  applyAll();
}
