import Dexie, { type EntityTable } from 'dexie';
import type { Activity, DeviceSettings, TimeEntry, UserSettings, Habit, HabitEntry, Note, PomodoroPreset, Project, ProjectTask, TodayTask, ProjectFolder, InboxItem, MindMap, PdfDocument, TimeBox, VaultBaseEntry } from '@shared/types';
import { DEFAULT_DEVICE_SETTINGS, DEFAULT_SETTINGS } from '@shared/constants';
import { classifyTimeBoxForMigration } from './migrations';
import { getLogicalDate } from '../utils/time';

const db = new Dexie('TimeTrackerDB') as Dexie & {
  activities: EntityTable<Activity, 'id'>;
  timeEntries: EntityTable<TimeEntry, 'id'>;
  settings: EntityTable<UserSettings, 'id'>;
  deviceSettings: EntityTable<DeviceSettings, 'id'>;
  habits: EntityTable<Habit, 'id'>;
  habitEntries: EntityTable<HabitEntry, 'id'>;
  notes: EntityTable<Note, 'id'>;
  pomodoroPresets: EntityTable<PomodoroPreset, 'id'>;
  projects: EntityTable<Project, 'id'>;
  projectTasks: EntityTable<ProjectTask, 'id'>;
  todayTasks: EntityTable<TodayTask, 'id'>;
  projectFolders: EntityTable<ProjectFolder, 'id'>;
  inboxItems: EntityTable<InboxItem, 'id'>;
  mindMaps: EntityTable<MindMap, 'id'>;
  pdfDocuments: EntityTable<PdfDocument, 'id'>;
  vaultBase: EntityTable<VaultBaseEntry, 'path'>;
};

db.version(1).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
});

db.version(2).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
});

db.version(3).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
});

db.version(4).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
});

db.version(5).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
});

db.version(6).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
}).upgrade(tx => {
  tx.table('projects').toCollection().modify(p => {
    if (p.folderId === undefined) p.folderId = null;
  });
  tx.table('projectTasks').toCollection().modify(t => {
    if (t.recurrenceRule === undefined) t.recurrenceRule = null;
    if (t.lastRecurredDate === undefined) t.lastRecurredDate = null;
  });
});

db.version(7).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
});

db.version(8).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
  mindMaps: 'id, deletedAt, updatedAt',
});

db.version(9).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
  mindMaps: 'id, deletedAt, updatedAt',
  pdfDocuments: 'id, isPinned, deletedAt, updatedAt',
});

db.version(10).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt, timeBox, scheduledDate',
  // Unchanged from v9 — re-declared (not just projectTasks) because the upgrade
  // below reads todayTasks (to classify) and writes settings (to stamp
  // lastRolloverDate), and a Dexie upgrade transaction can only touch tables
  // named in its own version's stores() call.
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
  mindMaps: 'id, deletedAt, updatedAt',
  pdfDocuments: 'id, isPinned, deletedAt, updatedAt',
}).upgrade(async tx => {
  const settingsRow = await tx.table('settings').get('default');
  const dayStartHour = settingsRow?.dayStartHour ?? DEFAULT_SETTINGS.dayStartHour;
  const today = getLogicalDate(dayStartHour);

  // "In today's list" = a non-deleted TodayTask row for today's logical date —
  // the only signal the pre-box data model has for "the user picked this for
  // today". Preloaded as a Set so classifying each task is an O(1) lookup.
  const todayRows = await tx.table('todayTasks')
    .filter((t: TodayTask) => !t.deletedAt && t.date === today)
    .toArray();
  const inTodayListIds = new Set(todayRows.map((t: TodayTask) => t.projectTaskId));

  // Soft-deleted rows are included on purpose — they keep a valid timeBox
  // even though no view queries them, so nothing downstream has to special-case
  // a missing field on undelete or vault re-import.
  const tasks = await tx.table('projectTasks').toArray();
  tasks.sort((a, b) => (a.projectId === b.projectId ? a.sortOrder - b.sortOrder : (a.projectId < b.projectId ? -1 : 1)));

  const boxOrderCounters: Record<TimeBox, number> = { today: 0, week: 0, later: 0 };
  const reclassified = tasks.map(task => {
    const timeBox = classifyTimeBoxForMigration(task, inTodayListIds.has(task.id), today, dayStartHour);
    return { ...task, timeBox, scheduledDate: null, timeBoxOrder: boxOrderCounters[timeBox]++ };
  });
  if (reclassified.length) await tx.table('projectTasks').bulkPut(reclassified);

  // Stamped in the same transaction as the classification above: without it,
  // useTaskRollover() (added later) would see `lastRolloverDate` as unset and
  // immediately demote everything this migration just placed in 'today'.
  if (settingsRow) {
    await tx.table('settings').update('default', { lastRolloverDate: today });
  }
});

// Settings-only migration: no new indexes, but existing vaults need explicit
// values so a later sync exports the new appearance and tracking preferences.
db.version(11).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt, timeBox, scheduledDate',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
  mindMaps: 'id, deletedAt, updatedAt',
  pdfDocuments: 'id, isPinned, deletedAt, updatedAt',
}).upgrade(async tx => {
  const settings = await tx.table('settings').get('default');
  if (!settings) return;
  await tx.table('settings').update('default', {
    timeTrackingVisible: settings.timeTrackingVisible ?? DEFAULT_SETTINGS.timeTrackingVisible,
    projectListFontOverridePx: settings.projectListFontOverridePx ?? null,
    projectNoteFontOverridePx: settings.projectNoteFontOverridePx ?? null,
    theme: settings.theme === 'dark' ? 'gruvbox-dark' : (settings.theme === 'notion' || settings.theme === 'neu-light' ? 'light' : settings.theme),
  });
});

// Settings-only migration: switch the existing install base to the new
// editorial default and make the preference explicit for vault sync.
db.version(12).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt, timeBox, scheduledDate',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
  mindMaps: 'id, deletedAt, updatedAt',
  pdfDocuments: 'id, isPinned, deletedAt, updatedAt',
}).upgrade(async tx => {
  const settings = await tx.table('settings').get('default');
  if (!settings) return;
  await tx.table('settings').update('default', {
    fontFamily: DEFAULT_DEVICE_SETTINGS.fontFamily,
  });
});

// Split preferences that describe this installation from settings that belong
// to the shared vault. Existing values are retained locally, while future
// vault imports can no longer overwrite paths, appearance, or navigation.
db.version(13).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  deviceSettings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt, timeBox, scheduledDate',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
  mindMaps: 'id, deletedAt, updatedAt',
  pdfDocuments: 'id, isPinned, deletedAt, updatedAt',
}).upgrade(async tx => {
  const settings = await tx.table('settings').get('default') as Record<string, unknown> | undefined;
  if (!settings) return;

  const device: Record<string, unknown> = { id: 'default', ...DEFAULT_DEVICE_SETTINGS };
  for (const key of Object.keys(DEFAULT_DEVICE_SETTINGS)) {
    if (settings[key] != null) device[key] = settings[key];
    delete settings[key];
  }
  await tx.table('deviceSettings').put(device);
  await tx.table('settings').put(settings);
});

// Record what each vault file looked like at the last agreed sync, so a
// Syncthing conflict copy can be merged three-way instead of one side
// winning wholesale. Starts empty: with no base recorded, the first merge
// after this upgrade unions both sides rather than inferring deletions.
db.version(14).stores({
  activities: 'id, name, sortOrder, deletedAt, updatedAt',
  timeEntries: 'id, activityId, date, startedAt, endedAt, deletedAt, updatedAt',
  settings: 'id',
  deviceSettings: 'id',
  habits: 'id, name, sortOrder, deletedAt, updatedAt',
  habitEntries: 'id, habitId, date, deletedAt, updatedAt, [habitId+date]',
  notes: 'id, isPinned, deletedAt, updatedAt',
  pomodoroPresets: 'id, name, sortOrder, deletedAt, updatedAt',
  projects: 'id, name, folderId, sortOrder, isArchived, deletedAt, updatedAt',
  projectTasks: 'id, projectId, sortOrder, isCompleted, deletedAt, updatedAt, timeBox, scheduledDate',
  todayTasks: 'id, projectTaskId, projectId, date, isCompleted, deletedAt, updatedAt',
  projectFolders: 'id, name, parentFolderId, sortOrder, deletedAt, updatedAt',
  inboxItems: 'id, deletedAt, updatedAt',
  mindMaps: 'id, deletedAt, updatedAt',
  pdfDocuments: 'id, isPinned, deletedAt, updatedAt',
  vaultBase: 'path',
});

/**
 * Hard-deletes every vault-synced row — the app's only sanctioned
 * exception to the no-hard-deletes/`deletedAt` rule. Irreversible on its
 * own; only ever called from `vaultStore.switchVault`, immediately after
 * `snapshotAllTables()`, so the caller can `restoreFromSnapshot` if the
 * switch fails partway through. Never call this without a snapshot to
 * fall back to.
 */
export async function clearAllTables() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (table.name === 'deviceSettings') continue;
      await table.clear();
    }
  });
}

export async function snapshotAllTables(): Promise<Map<string, any[]>> {
  const snapshot = new Map<string, any[]>();
  for (const table of db.tables) {
    if (table.name === 'deviceSettings') continue;
    snapshot.set(table.name, await table.toArray());
  }
  return snapshot;
}

/**
 * Wipes every table and bulk-restores rows from a prior
 * `snapshotAllTables()` — the rollback half of the `clearAllTables` /
 * vault-switch exception to no-hard-deletes. Only called from
 * `vaultStore.switchVault`'s catch block, to undo a `clearAllTables` whose
 * subsequent import failed. Not a general-purpose backup/restore API.
 */
export async function restoreFromSnapshot(snapshot: Map<string, any[]>): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (table.name === 'deviceSettings') continue;
      await table.clear();
    }
    for (const table of db.tables) {
      if (table.name === 'deviceSettings') continue;
      const rows = snapshot.get(table.name);
      if (rows?.length) await table.bulkPut(rows);
    }
  });
}

export { db };
