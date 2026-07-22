import Dexie, { type EntityTable } from 'dexie';
import type { Activity, TimeEntry, UserSettings, Habit, HabitEntry, Note, PomodoroPreset, Project, ProjectTask, TodayTask, ProjectFolder, InboxItem, MindMap, PdfDocument, TimeBox } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { classifyTimeBoxForMigration } from './migrations';
import { getLogicalDate } from '../utils/time';

const db = new Dexie('TimeTrackerDB') as Dexie & {
  activities: EntityTable<Activity, 'id'>;
  timeEntries: EntityTable<TimeEntry, 'id'>;
  settings: EntityTable<UserSettings, 'id'>;
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

/**
 * Hard-deletes every row in every table — the app's only sanctioned
 * exception to the no-hard-deletes/`deletedAt` rule. Irreversible on its
 * own; only ever called from `vaultStore.switchVault`, immediately after
 * `snapshotAllTables()`, so the caller can `restoreFromSnapshot` if the
 * switch fails partway through. Never call this without a snapshot to
 * fall back to.
 */
export async function clearAllTables() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
}

export async function snapshotAllTables(): Promise<Map<string, any[]>> {
  const snapshot = new Map<string, any[]>();
  for (const table of db.tables) {
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
      await table.clear();
    }
    for (const table of db.tables) {
      const rows = snapshot.get(table.name);
      if (rows?.length) await table.bulkPut(rows);
    }
  });
}

export { db };
