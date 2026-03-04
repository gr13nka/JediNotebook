import Dexie, { type EntityTable } from 'dexie';
import type { Activity, TimeEntry, UserSettings, Habit, HabitEntry, Note, PomodoroPreset, Project, ProjectTask, TodayTask, ProjectFolder, InboxItem, MindMap, PdfDocument } from '@shared/types';

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

export async function clearAllTables() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
}

export { db };
