import type {
  Activity, TimeEntry, UserSettings,
  Project, ProjectTask, TodayTask,
  ProjectFolder, InboxItem,
} from '@shared/types';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import {
  ACTIVITIES, PROJECTS, PROJECT_TASKS, TIME_LOG, TODAY, INBOX, SETTINGS, FOLDERS,
} from './vaultLayout';
import { extractNameFromDirName } from './sanitize';

// ─── Helpers ──────────────────────────────────────────────────────

/** Strip fields that are only relevant in Dexie (deletedAt is never written to disk) */
function omitDeleted<T extends { deletedAt?: string | null }>(obj: T): Omit<T, 'deletedAt'> {
  const { deletedAt: _, ...rest } = obj;
  return rest;
}

function pickMeta(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) meta[k] = (obj as any)[k];
  }
  return meta;
}

// ─── Activity ─────────────────────────────────────────────────────

const ACTIVITY_META_KEYS = [
  'id', 'color', 'dailyBudgetMinutes', 'isBreak', 'sortOrder',
  'createdAt', 'updatedAt', 'deviceId',
];

export function serializeActivity(a: Activity): { path: string; content: string } {
  const meta = pickMeta(omitDeleted(a) as any, ACTIVITY_META_KEYS);
  const body = `# ${a.name}\n`;
  return {
    path: ACTIVITIES.buildPath(a.name, a.id),
    content: stringifyFrontmatter(meta, body),
  };
}

export function deserializeActivity(content: string): Omit<Activity, 'deletedAt'> {
  const { meta, body } = parseFrontmatter(content);
  // Extract name from body heading or fallback
  let name = (meta.name as string) || '';
  if (!name) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    name = headingMatch ? headingMatch[1].trim() : 'Untitled';
  }
  return {
    id: meta.id as string,
    name,
    color: (meta.color as string) || '#E04848',
    dailyBudgetMinutes: (meta.dailyBudgetMinutes as number) ?? 60,
    isBreak: (meta.isBreak as boolean) ?? false,
    sortOrder: (meta.sortOrder as number) ?? 0,
    createdAt: meta.createdAt as string,
    updatedAt: meta.updatedAt as string,
    deviceId: meta.deviceId as string,
  };
}

// ─── Project ──────────────────────────────────────────────────────

const PROJECT_META_KEYS = [
  'id', 'color', 'icon', 'sortOrder', 'isArchived', 'folderId', 'linkedActivityId',
  'createdAt', 'updatedAt', 'deviceId',
];

/** Serialize project.md — the project's own fields. Independent of its tasks. */
export function serializeProjectFile(p: Project): { path: string; content: string } {
  const meta = pickMeta(omitDeleted(p) as any, PROJECT_META_KEYS);
  const body = p.description || '';
  return {
    path: PROJECTS.buildPath(p.name, p.id),
    content: stringifyFrontmatter(meta, body),
  };
}

/** Serialize tasks.md for one project: frontmatter task list + human-readable checklist. */
export function serializeProjectTasksFile(
  p: Project,
  tasks: ProjectTask[],
): { path: string; content: string } {
  const activeTasks = tasks
    .filter(t => !t.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const tasksMeta: Record<string, unknown> = {
    projectId: p.id,
    updatedAt: new Date().toISOString(),
    tasks: activeTasks.map(t => ({
      id: t.id,
      title: t.title,
      sortOrder: t.sortOrder,
      isCompleted: t.isCompleted,
      completedAt: t.completedAt,
      recurrenceRule: t.recurrenceRule,
      lastRecurredDate: t.lastRecurredDate,
      timeBox: t.timeBox,
      scheduledDate: t.scheduledDate,
      timeBoxOrder: t.timeBoxOrder,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      deviceId: t.deviceId,
    })),
  };

  // Human-readable checklist body
  const checklist = activeTasks
    .map(t => `- [${t.isCompleted ? 'x' : ' '}] ${t.title}`)
    .join('\n');

  return {
    path: PROJECT_TASKS.buildPath(p.name, p.id),
    content: stringifyFrontmatter(tasksMeta, checklist ? `## Tasks\n\n${checklist}\n` : ''),
  };
}

/**
 * `dirName` is the project's directory name as it appears on disk (e.g.
 * "Meeting Notes (019abc)") — the name is encoded there, not in the
 * frontmatter, so it's decoded here rather than left for the caller.
 */
export function deserializeProject(dirName: string, content: string): Omit<Project, 'deletedAt'> {
  const { meta, body } = parseFrontmatter(content);
  return {
    id: meta.id as string,
    name: extractNameFromDirName(dirName),
    description: body.trim(),
    color: (meta.color as string) || '#2BA89E',
    icon: (meta.icon as string) || '',
    sortOrder: (meta.sortOrder as number) ?? 0,
    isArchived: (meta.isArchived as boolean) ?? false,
    folderId: (meta.folderId as string) || null,
    linkedActivityId: (meta.linkedActivityId as string) || null,
    createdAt: meta.createdAt as string,
    updatedAt: meta.updatedAt as string,
    deviceId: meta.deviceId as string,
  };
}

/**
 * `timeBox`/`scheduledDate`/`timeBoxOrder` default when absent so files
 * written by pre-Phase-5 app versions still load: `timeBox` falls back to
 * `'later'` (the same default a freshly created task gets), `scheduledDate`
 * to unpinned, `timeBoxOrder` to `0`.
 */
export function deserializeProjectTasks(tasksContent: string): Omit<ProjectTask, 'deletedAt'>[] {
  const { meta } = parseFrontmatter(tasksContent);
  const tasks = (meta.tasks as any[]) || [];
  return tasks.map(t => ({
    id: t.id,
    projectId: meta.projectId as string,
    title: t.title || '',
    sortOrder: t.sortOrder ?? 0,
    isCompleted: t.isCompleted ?? false,
    completedAt: t.completedAt || null,
    recurrenceRule: t.recurrenceRule || null,
    lastRecurredDate: t.lastRecurredDate || null,
    timeBox: t.timeBox || 'later',
    scheduledDate: t.scheduledDate || null,
    timeBoxOrder: typeof t.timeBoxOrder === 'number' ? t.timeBoxOrder : 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deviceId: t.deviceId,
  }));
}

// ─── Time Log (per-date) ──────────────────────────────────────────

export function serializeTimeEntries(
  date: string,
  entries: TimeEntry[],
  activityNames: Map<string, string>,
): { path: string; content: string } {
  const activeEntries = entries
    .filter(e => !e.deletedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const meta: Record<string, unknown> = {
    date,
    updatedAt: new Date().toISOString(),
    entries: activeEntries.map(e => ({
      id: e.id,
      activityId: e.activityId,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      durationSeconds: e.durationSeconds,
      isManual: e.isManual,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      deviceId: e.deviceId,
    })),
  };

  // Human-readable table body
  const d = new Date(date + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let body = `## Time Log — ${dateLabel}\n\n`;

  if (activeEntries.length > 0) {
    body += '| Time | Activity | Duration |\n|------|----------|----------|\n';
    for (const e of activeEntries) {
      const start = new Date(e.startedAt);
      const startStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
      let endStr = '...';
      if (e.endedAt) {
        const end = new Date(e.endedAt);
        endStr = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
      }
      const actName = activityNames.get(e.activityId) || 'Unknown';
      const dur = formatDurationSimple(e.durationSeconds);
      body += `| ${startStr} - ${endStr} | ${actName} | ${dur} |\n`;
    }
  }

  return {
    path: TIME_LOG.buildPath(date),
    content: stringifyFrontmatter(meta, body),
  };
}

export function deserializeTimeLog(content: string): {
  date: string;
  entries: Omit<TimeEntry, 'deletedAt'>[];
} {
  const { meta } = parseFrontmatter(content);
  const date = meta.date as string;
  const rawEntries = (meta.entries as any[]) || [];

  const entries = rawEntries.map(e => ({
    id: e.id as string,
    activityId: e.activityId as string,
    startedAt: e.startedAt as string,
    endedAt: (e.endedAt as string) || null,
    durationSeconds: (e.durationSeconds as number) ?? 0,
    isManual: (e.isManual as boolean) ?? false,
    date,
    createdAt: e.createdAt as string,
    updatedAt: e.updatedAt as string,
    deviceId: e.deviceId as string,
  }));

  return { date, entries };
}

// ─── Today Tasks (per-date) ───────────────────────────────────────

export function serializeTodayTasks(
  date: string,
  tasks: TodayTask[],
  taskTitles: Map<string, string>,
): { path: string; content: string } {
  const activeTasks = tasks
    .filter(t => !t.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const meta: Record<string, unknown> = {
    date,
    updatedAt: new Date().toISOString(),
    tasks: activeTasks.map(t => ({
      id: t.id,
      projectTaskId: t.projectTaskId,
      projectId: t.projectId,
      sortOrder: t.sortOrder,
      isCompleted: t.isCompleted,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      deviceId: t.deviceId,
    })),
  };

  const checklist = activeTasks
    .map(t => {
      const title = taskTitles.get(t.projectTaskId) || 'Unknown task';
      return `- [${t.isCompleted ? 'x' : ' '}] ${title}`;
    })
    .join('\n');

  return {
    path: TODAY.buildPath(date),
    content: stringifyFrontmatter(meta, checklist ? `## Today — ${date}\n\n${checklist}\n` : ''),
  };
}

export function deserializeTodayTasks(content: string): {
  date: string;
  tasks: Omit<TodayTask, 'deletedAt'>[];
} {
  const { meta } = parseFrontmatter(content);
  const date = meta.date as string;
  const rawTasks = (meta.tasks as any[]) || [];

  const tasks = rawTasks.map(t => ({
    id: t.id as string,
    projectTaskId: t.projectTaskId as string,
    projectId: t.projectId as string,
    sortOrder: (t.sortOrder as number) ?? 0,
    isCompleted: (t.isCompleted as boolean) ?? false,
    completedAt: (t.completedAt as string) || null,
    date,
    createdAt: t.createdAt as string,
    updatedAt: t.updatedAt as string,
    deviceId: t.deviceId as string,
  }));

  return { date, tasks };
}

// ─── Inbox ────────────────────────────────────────────────────────

export function serializeInbox(items: InboxItem[]): { path: string; content: string } {
  const activeItems = items
    .filter(i => !i.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const meta: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    items: activeItems.map(i => ({
      id: i.id,
      text: i.text,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      deviceId: i.deviceId,
    })),
  };

  const body = activeItems.length > 0
    ? '## Inbox\n\n' + activeItems.map(i => `- ${i.text}`).join('\n') + '\n'
    : '';

  return {
    path: INBOX.path,
    content: stringifyFrontmatter(meta, body),
  };
}

export function deserializeInbox(content: string): Omit<InboxItem, 'deletedAt'>[] {
  const { meta } = parseFrontmatter(content);
  const rawItems = (meta.items as any[]) || [];
  return rawItems.map(i => ({
    id: i.id as string,
    text: i.text as string,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
    deviceId: i.deviceId as string,
  }));
}

// ─── Settings (JSON, not frontmatter) ─────────────────────────────

export function serializeSettings(s: UserSettings): { path: string; content: string } {
  const { id: _, deletedAt: _d, ...rest } = s as any;
  return {
    path: SETTINGS.path,
    content: JSON.stringify(rest, null, 2) + '\n',
  };
}

export function deserializeSettings(content: string): Partial<UserSettings> {
  return JSON.parse(content);
}

// ─── Project Folders (JSON) ───────────────────────────────────────

export function serializeFolders(
  folders: ProjectFolder[],
): { path: string; content: string } {
  // omitDeleted() here for consistency with every other serializer (Phase
  // 3.1b) — previously this was the one serializer that wrote a surviving
  // row's `deletedAt: null` to disk verbatim. deserializeFolders already
  // tolerates the key being absent (destructuring an absent key is a no-op),
  // so this is a pure write-side normalization.
  const active = folders.filter(f => !f.deletedAt).map(omitDeleted);
  return {
    path: FOLDERS.path,
    content: JSON.stringify(active, null, 2) + '\n',
  };
}

export function deserializeFolders(content: string): Omit<ProjectFolder, 'deletedAt'>[] {
  const arr = JSON.parse(content) as any[];
  return arr.map(f => {
    const { deletedAt: _, ...rest } = f;
    return rest;
  });
}

// ─── Helper ───────────────────────────────────────────────────────

function formatDurationSimple(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
