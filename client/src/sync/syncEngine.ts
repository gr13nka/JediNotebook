import { db } from '../db';
import { useSettingsStore } from '../stores/settingsStore';
import type { SyncPayload, SyncResponse } from '@shared/types';

let lastSyncedAt = localStorage.getItem('web_timer_lastSyncedAt') || '1970-01-01T00:00:00.000Z';

export async function syncNow(): Promise<void> {
  const settings = useSettingsStore.getState();
  if (!settings.syncEnabled || !settings.syncServerUrl) return;

  const baseUrl = settings.syncServerUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.syncApiKey) {
    headers['X-API-Key'] = settings.syncApiKey;
  }

  // Pull changes from server
  const pullRes = await fetch(
    `${baseUrl}/api/sync/changes?since=${encodeURIComponent(lastSyncedAt)}`,
    { headers },
  );

  if (!pullRes.ok) {
    throw new Error(`Sync pull failed: ${pullRes.status}`);
  }

  const serverData: SyncResponse = await pullRes.json();

  // Apply server changes locally (LWW)
  for (const activity of serverData.activities) {
    const local = await db.activities.get(activity.id);
    if (!local || activity.updatedAt > local.updatedAt) {
      await db.activities.put(activity);
    }
  }

  for (const entry of serverData.timeEntries) {
    const local = await db.timeEntries.get(entry.id);
    if (!local || entry.updatedAt > local.updatedAt) {
      await db.timeEntries.put(entry);
    }
  }

  if (serverData.settings) {
    const localSettings = await db.settings.get('default');
    if (!localSettings || serverData.settings.updatedAt > localSettings.updatedAt) {
      await db.settings.put({ ...serverData.settings, id: 'default' });
    }
  }

  // Push local changes to server
  const localActivities = await db.activities
    .filter((a) => a.updatedAt > lastSyncedAt)
    .toArray();
  const localEntries = await db.timeEntries
    .filter((e) => e.updatedAt > lastSyncedAt)
    .toArray();
  const localSettings = await db.settings.get('default');

  const payload: SyncPayload = {
    activities: localActivities,
    timeEntries: localEntries,
    settings:
      localSettings && localSettings.updatedAt > lastSyncedAt
        ? localSettings
        : null,
    lastSyncedAt,
  };

  const pushRes = await fetch(`${baseUrl}/api/sync/changes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!pushRes.ok) {
    throw new Error(`Sync push failed: ${pushRes.status}`);
  }

  lastSyncedAt = serverData.serverTime || new Date().toISOString();
  localStorage.setItem('web_timer_lastSyncedAt', lastSyncedAt);
}
