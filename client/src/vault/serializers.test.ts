import { describe, it, expect } from 'vitest';
import {
  serializeActivity, deserializeActivity,
  serializeProjectFile, serializeProjectTasksFile, deserializeProject, deserializeProjectTasks,
  serializeTimeEntries, deserializeTimeLog,
  serializeTodayTasks, deserializeTodayTasks,
  serializeInbox, deserializeInbox,
  serializeSettings, deserializeSettings,
  serializeFolders, deserializeFolders,
} from './serializers';
import { sanitizeFilename, shortId, entityFilename } from './sanitize';
import { stringifyFrontmatter } from './frontmatter';
import type {
  Activity, Project, ProjectTask, TimeEntry, TodayTask,
  InboxItem, UserSettings, ProjectFolder, RecurrenceRule,
} from '@shared/types';

// This is the highest-value suite in the safety net: Phase 3 reshapes these
// serializers, so every entity kind gets a realistic round trip, plus an
// explicit pin for every place the code deliberately drops or defaults a
// field on the way back from disk.

const SPECIAL_CHARS = 'Foo/Bar: "Baz" <Test>|Pipe #hash \\slash';
const NON_ASCII = 'Задача café — важно 日本語';

// ─── Fixture builders ────────────────────────────────────────────────

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: '0199f2ab-0000-7abc-8000-abcdef123456',
    name: 'Deep Work',
    color: '#E04848',
    dailyBudgetMinutes: 120,
    isBreak: false,
    sortOrder: 3,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-02T09:30:00.000Z',
    deletedAt: null,
    deviceId: 'device-abc',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: '0199f2ab-1111-7abc-8000-abcdef123456',
    name: 'My Project',
    description: 'Line one.\nLine two with a # hash and a : colon.',
    color: '#2BA89E',
    icon: '📁',
    sortOrder: 2,
    isArchived: false,
    folderId: 'folder-1',
    linkedActivityId: 'activity-1',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-02T09:30:00.000Z',
    deletedAt: null,
    deviceId: 'device-abc',
    ...overrides,
  };
}

function makeTask(overrides: Partial<ProjectTask> = {}): ProjectTask {
  const recurrenceRule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 15, daysOfWeek: [1, 3] };
  return {
    id: '0199f2ab-2222-7abc-8000-abcdef123456',
    projectId: '0199f2ab-1111-7abc-8000-abcdef123456',
    title: 'Write the report',
    sortOrder: 0,
    isCompleted: false,
    completedAt: null,
    recurrenceRule,
    lastRecurredDate: '2026-06-15',
    timeBox: 'later',
    scheduledDate: null,
    timeBoxOrder: 0,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-02T09:30:00.000Z',
    deletedAt: null,
    deviceId: 'device-abc',
    ...overrides,
  };
}

function makeTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: '0199f2ab-3333-7abc-8000-abcdef123456',
    activityId: '0199f2ab-0000-7abc-8000-abcdef123456',
    startedAt: '2026-07-21T09:00:00.000Z',
    endedAt: '2026-07-21T10:30:00.000Z',
    durationSeconds: 5400,
    isManual: false,
    date: '2026-07-21',
    createdAt: '2026-07-21T09:00:00.000Z',
    updatedAt: '2026-07-21T10:30:00.000Z',
    deletedAt: null,
    deviceId: 'device-abc',
    ...overrides,
  };
}

function makeTodayTask(overrides: Partial<TodayTask> = {}): TodayTask {
  return {
    id: '0199f2ab-4444-7abc-8000-abcdef123456',
    projectTaskId: '0199f2ab-2222-7abc-8000-abcdef123456',
    projectId: '0199f2ab-1111-7abc-8000-abcdef123456',
    sortOrder: 0,
    isCompleted: false,
    completedAt: null,
    date: '2026-07-21',
    createdAt: '2026-07-21T08:00:00.000Z',
    updatedAt: '2026-07-21T08:00:00.000Z',
    deletedAt: null,
    deviceId: 'device-abc',
    ...overrides,
  };
}

function makeInboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: '0199f2ab-5555-7abc-8000-abcdef123456',
    text: 'Call the dentist',
    createdAt: '2026-07-21T08:00:00.000Z',
    updatedAt: '2026-07-21T08:00:00.000Z',
    deletedAt: null,
    deviceId: 'device-abc',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: 'default',
    dayStartHour: 6,
    dayEndHour: 2,
    timezone: 'Europe/Athens',
    barStyle: 'thick-linear',
    darkMode: false,
    theme: 'dark',
    language: 'en',
    maxTasksPerProject: 5,
    navPosition: 'left',
    pointsCounterVisible: true,
    accentColor: '#4C8BF5',
    fontFamily: 'source-serif-4',
    uiZoom: 110,
    pointsColorFixed: false,
    hiddenNavTabs: ['/mindmap'],
    navTabOrder: ['/', '/today', '/projects'],
    dropdownFabCorner: 'bottom-right',
    customThemeColors: {
      bgPrimary: '#1a1a2e',
      bgCard: '#16213e',
      bgElevated: '#1a3a5c',
      textPrimary: '#eaeaea',
      textSecondary: '#a0a0b0',
      textMuted: '#5a5a6e',
      accent: '#e94560',
      accentFg: '#ffffff',
      green: '#27ae60',
      red: '#e74c3c',
      barTrack: '#1a3a5c',
      border: '#1a3a5c',
    },
    vaultEnabled: true,
    vaultPath: '/Users/me/MyVault',
    vaultSetupDone: true,
    recentVaults: [{ path: '/Users/me/MyVault', name: 'MyVault', lastOpened: '2026-07-20T00:00:00.000Z' }],
    bottomNavTabs: ['/inbox', '/projects', '/tasks', '/today', '/settings'],
    bottomNavScrollable: false,
    bottomNavPages: [
      ['/', '/today', '/projects', '/inbox'],
      ['/tasks', '/settings'],
    ],
    mobileProjectGrid: false,
    lastRolloverDate: null,
    updatedAt: '2026-07-21T08:00:00.000Z',
    deviceId: 'device-abc',
    ...overrides,
  };
}

function makeFolder(overrides: Partial<ProjectFolder> = {}): ProjectFolder {
  return {
    id: '0199f2ab-6666-7abc-8000-abcdef123456',
    name: 'Work',
    color: '#888888',
    sortOrder: 0,
    parentFolderId: null,
    isExpanded: true,
    createdAt: '2026-07-21T08:00:00.000Z',
    updatedAt: '2026-07-21T08:00:00.000Z',
    deletedAt: null,
    deviceId: 'device-abc',
    ...overrides,
  };
}

// ─── Activity ─────────────────────────────────────────────────────

describe('Activity serialization', () => {
  it('round-trips a realistic activity (deletedAt deliberately excluded)', () => {
    const a = makeActivity();
    const { path, content } = serializeActivity(a);
    expect(path).toBe(`activities/${entityFilename(a.name, a.id)}.md`);

    const back = deserializeActivity(content);
    expect('deletedAt' in back).toBe(false); // omitDeleted() — never written to disk
    const { deletedAt, ...expected } = a;
    expect(back).toEqual(expected);
  });

  it('round-trips a name with unsafe filesystem characters via the markdown heading', () => {
    const a = makeActivity({ name: SPECIAL_CHARS });
    const back = deserializeActivity(serializeActivity(a).content);
    expect(back.name).toBe(SPECIAL_CHARS);
  });

  it('round-trips a non-ASCII name', () => {
    const a = makeActivity({ name: NON_ASCII });
    const back = deserializeActivity(serializeActivity(a).content);
    expect(back.name).toBe(NON_ASCII);
  });

  it(
    'BUG (pinned, not fixed): an empty name round-trips as "Untitled" instead of "". ' +
      'ACTIVITY_META_KEYS never includes `name`, so the only place a name survives ' +
      'is the markdown heading `# ${name}`. An empty name serializes to a bare ' +
      '"# " heading line, which /^#\\s+(.+)$/m cannot match (it requires at least ' +
      'one captured character after the required whitespace), so deserializeActivity ' +
      "falls through to its 'Untitled' fallback.",
    () => {
      const a = makeActivity({ name: '' });
      const back = deserializeActivity(serializeActivity(a).content);
      expect(back.name).toBe('Untitled');
    },
  );

  it('sanitizes unsafe characters out of the generated filename (filename encoding pin)', () => {
    const a = makeActivity({ name: SPECIAL_CHARS });
    const { path } = serializeActivity(a);
    expect(path).toBe(`activities/${sanitizeFilename(SPECIAL_CHARS)} (${shortId(a.id)}).md`);
    expect(path).toBe('activities/Foo-Bar- -Baz- -Test--Pipe #hash -slash (0199f2).md');
  });
});

// ─── Project (+ tasks) ────────────────────────────────────────────

describe('Project + tasks serialization', () => {
  it('round-trips project fields, including name (decoded from the directory name)', () => {
    const p = makeProject();
    const { path, content } = serializeProjectFile(p);
    const dirName = entityFilename(p.name, p.id);
    expect(path).toBe(`projects/${dirName}/project.md`);

    // Phase 3.1b: deserializeProject(dirName, content) decodes the name from
    // the directory name itself, rather than returning name: '' and leaving
    // that to the caller.
    const back = deserializeProject(dirName, content);
    expect(back.name).toBe(p.name);
    const { deletedAt, ...expected } = p;
    expect(back).toEqual(expected);
  });

  it('round-trips a project name with unsafe characters into the directory name (filename encoding pin)', () => {
    const p = makeProject({ name: SPECIAL_CHARS });
    const projectFile = serializeProjectFile(p);
    const tasksFile = serializeProjectTasksFile(p, []);
    const expectedDir = `${sanitizeFilename(SPECIAL_CHARS)} (${shortId(p.id)})`;
    expect(projectFile.path).toBe(`projects/${expectedDir}/project.md`);
    expect(tasksFile.path).toBe(`projects/${expectedDir}/tasks.md`);

    // The directory name only round-trips exactly for names that don't
    // collide with sanitization (no unsafe chars to begin with); SPECIAL_CHARS
    // does, so decoding it back recovers the sanitized form, not the original.
    const back = deserializeProject(expectedDir, projectFile.content);
    expect(back.name).toBe(sanitizeFilename(SPECIAL_CHARS));
  });

  it('filters soft-deleted tasks and sorts the rest by sortOrder', () => {
    const p = makeProject();
    const t1 = makeTask({ id: 'task-1', title: 'Second', sortOrder: 1 });
    const t2 = makeTask({ id: 'task-2', title: 'First', sortOrder: 0 });
    const deletedTask = makeTask({ id: 'task-3', title: 'Deleted', sortOrder: -1, deletedAt: '2026-07-01T00:00:00.000Z' });
    const { content: tasksContent } = serializeProjectTasksFile(p, [t1, t2, deletedTask]);

    const back = deserializeProjectTasks(tasksContent);
    expect(back.map(t => t.id)).toEqual(['task-2', 'task-1']); // sorted, deleted one dropped
  });

  it('round-trips task fields including a full recurrence rule (deletedAt excluded)', () => {
    const p = makeProject();
    const task = makeTask({ title: SPECIAL_CHARS });
    const { content: tasksContent } = serializeProjectTasksFile(p, [task]);

    const [back] = deserializeProjectTasks(tasksContent);
    expect('deletedAt' in back).toBe(false);
    const { deletedAt, ...expected } = task;
    expect(back).toEqual(expected);
    expect(back.title).toBe(SPECIAL_CHARS);
  });

  it('round-trips a task with null recurrenceRule, lastRecurredDate and completedAt', () => {
    const p = makeProject();
    const task = makeTask({ recurrenceRule: null, lastRecurredDate: null, isCompleted: true, completedAt: '2026-07-20T12:00:00.000Z' });
    const { content: tasksContent } = serializeProjectTasksFile(p, [task]);

    const [back] = deserializeProjectTasks(tasksContent);
    expect(back.recurrenceRule).toBeNull();
    expect(back.lastRecurredDate).toBeNull();
    expect(back.completedAt).toBe('2026-07-20T12:00:00.000Z');
  });

  it('round-trips a non-ASCII task title', () => {
    const p = makeProject();
    const task = makeTask({ title: NON_ASCII });
    const { content: tasksContent } = serializeProjectTasksFile(p, [task]);

    const [back] = deserializeProjectTasks(tasksContent);
    expect(back.title).toBe(NON_ASCII);
  });

  it.each(['today', 'week', 'later'] as const)('round-trips a task with timeBox %s', (timeBox) => {
    const p = makeProject();
    const task = makeTask({ timeBox, timeBoxOrder: 4 });
    const { content: tasksContent } = serializeProjectTasksFile(p, [task]);

    const [back] = deserializeProjectTasks(tasksContent);
    expect(back.timeBox).toBe(timeBox);
    expect(back.timeBoxOrder).toBe(4);
  });

  it('round-trips a set scheduledDate', () => {
    const p = makeProject();
    const task = makeTask({ scheduledDate: '2026-07-25' });
    const { content: tasksContent } = serializeProjectTasksFile(p, [task]);

    const [back] = deserializeProjectTasks(tasksContent);
    expect(back.scheduledDate).toBe('2026-07-25');
  });

  it('round-trips a null scheduledDate (the unpinned default)', () => {
    const p = makeProject();
    const task = makeTask({ scheduledDate: null });
    const { content: tasksContent } = serializeProjectTasksFile(p, [task]);

    const [back] = deserializeProjectTasks(tasksContent);
    expect(back.scheduledDate).toBeNull();
  });

  it(
    'defaults timeBox/scheduledDate/timeBoxOrder when reading a legacy file written before ' +
      'Phase 5 (frontmatter has no time-box fields at all)',
    () => {
      const legacyContent = stringifyFrontmatter(
        {
          projectId: '0199f2ab-1111-7abc-8000-abcdef123456',
          updatedAt: '2026-01-02T09:30:00.000Z',
          tasks: [
            {
              id: 'task-legacy',
              title: 'Old task from before time-boxes',
              sortOrder: 0,
              isCompleted: false,
              completedAt: null,
              recurrenceRule: null,
              lastRecurredDate: null,
              createdAt: '2026-01-01T08:00:00.000Z',
              updatedAt: '2026-01-02T09:30:00.000Z',
              deviceId: 'device-abc',
            },
          ],
        },
        '## Tasks\n\n- [ ] Old task from before time-boxes\n',
      );

      const [back] = deserializeProjectTasks(legacyContent);
      expect(back.timeBox).toBe('later');
      expect(back.scheduledDate).toBeNull();
      expect(back.timeBoxOrder).toBe(0);
    },
  );
});

// ─── Time log ─────────────────────────────────────────────────────

describe('Time log serialization', () => {
  it('round-trips entries (deletedAt excluded, sorted by startedAt) for a matching date', () => {
    const date = '2026-07-21';
    const early = makeTimeEntry({ id: 'e-early', startedAt: '2026-07-21T08:00:00.000Z', date });
    const late = makeTimeEntry({ id: 'e-late', startedAt: '2026-07-21T14:00:00.000Z', date });
    const deleted = makeTimeEntry({ id: 'e-deleted', date, deletedAt: '2026-07-21T00:00:00.000Z' });
    const activityNames = new Map([[early.activityId, 'Deep Work']]);

    const { path, content } = serializeTimeEntries(date, [late, early, deleted], activityNames);
    expect(path).toBe(`time-log/${date}.md`);

    const back = deserializeTimeLog(content);
    expect(back.date).toBe(date);
    expect(back.entries.map(e => e.id)).toEqual(['e-early', 'e-late']); // sorted, deleted one dropped

    const [backEarly] = back.entries;
    expect('deletedAt' in backEarly).toBe(false);
    const { deletedAt, ...expected } = early;
    expect(backEarly).toEqual(expected);
  });

  it('round-trips a running entry (endedAt: null)', () => {
    const date = '2026-07-21';
    const running = makeTimeEntry({ endedAt: null, date });
    const back = deserializeTimeLog(serializeTimeEntries(date, [running], new Map()).content);
    expect(back.entries[0].endedAt).toBeNull();
  });

  it('round-trips a manual entry flag', () => {
    const date = '2026-07-21';
    const manual = makeTimeEntry({ isManual: true, date });
    const back = deserializeTimeLog(serializeTimeEntries(date, [manual], new Map()).content);
    expect(back.entries[0].isManual).toBe(true);
  });
});

// ─── Today tasks ──────────────────────────────────────────────────

describe('Today tasks serialization', () => {
  it('round-trips tasks (deletedAt excluded, sorted by sortOrder) using a taskTitles lookup', () => {
    const date = '2026-07-21';
    const t1 = makeTodayTask({ id: 'tt-1', projectTaskId: 'pt-1', sortOrder: 1 });
    const t2 = makeTodayTask({ id: 'tt-2', projectTaskId: 'pt-2', sortOrder: 0 });
    const deleted = makeTodayTask({ id: 'tt-3', deletedAt: '2026-07-20T00:00:00.000Z' });
    const taskTitles = new Map([
      ['pt-1', SPECIAL_CHARS],
      ['pt-2', NON_ASCII],
    ]);

    const { path, content } = serializeTodayTasks(date, [t1, t2, deleted], taskTitles);
    expect(path).toBe(`today/${date}.md`);
    // the title lookup only feeds the human-readable checklist body, not the
    // round-tripped data — confirm it doesn't blow up and the body contains it
    expect(content).toContain(NON_ASCII);

    const back = deserializeTodayTasks(content);
    expect(back.date).toBe(date);
    expect(back.tasks.map(t => t.id)).toEqual(['tt-2', 'tt-1']); // sorted, deleted one dropped

    const [backT2] = back.tasks;
    expect('deletedAt' in backT2).toBe(false);
    const { deletedAt, ...expected } = t2;
    expect(backT2).toEqual(expected);
  });

  it('falls back to "Unknown task" in the checklist body when a title is missing from the lookup', () => {
    const date = '2026-07-21';
    const task = makeTodayTask();
    const { content } = serializeTodayTasks(date, [task], new Map());
    expect(content).toContain('Unknown task');
  });
});

// ─── Inbox ────────────────────────────────────────────────────────

describe('Inbox serialization', () => {
  it('round-trips items (deletedAt excluded, sorted by createdAt)', () => {
    const early = makeInboxItem({ id: 'i-early', createdAt: '2026-07-21T08:00:00.000Z', text: SPECIAL_CHARS });
    const late = makeInboxItem({ id: 'i-late', createdAt: '2026-07-21T09:00:00.000Z', text: NON_ASCII });
    const deleted = makeInboxItem({ id: 'i-deleted', createdAt: '2026-07-21T07:00:00.000Z', deletedAt: '2026-07-21T00:00:00.000Z' });

    const { path, content } = serializeInbox([late, early, deleted]);
    expect(path).toBe('inbox.md');

    const back = deserializeInbox(content);
    expect(back.map(i => i.id)).toEqual(['i-early', 'i-late']); // sorted, deleted one dropped
    expect(back[0].text).toBe(SPECIAL_CHARS);
    expect(back[1].text).toBe(NON_ASCII);
    expect('deletedAt' in back[0]).toBe(false);
    const { deletedAt, ...expected } = early;
    expect(back[0]).toEqual(expected);
  });

  it('serializes an empty inbox without error', () => {
    const { content } = serializeInbox([]);
    expect(deserializeInbox(content)).toEqual([]);
  });
});

// ─── Settings ─────────────────────────────────────────────────────

describe('Settings serialization', () => {
  it(
    'round-trips settings fields except `id`, which is deliberately dropped. ' +
      "vaultSync.ts always re-injects `id: 'default'` on the way back into Dexie " +
      '(db.settings.put({ id: \'default\', ...imported })), so this is safe in practice ' +
      'but means deserializeSettings\'s return value alone is not a valid UserSettings.',
    () => {
      const s = makeSettings();
      const { path, content } = serializeSettings(s);
      expect(path).toBe('settings.json');

      const back = deserializeSettings(content);
      expect('id' in back).toBe(false);
      const { id, ...expected } = s;
      expect(back).toEqual(expected);
    },
  );

  it('round-trips the recentVaults array structure', () => {
    const s = makeSettings({
      recentVaults: [
        { path: '/a', name: 'A', lastOpened: '2026-07-01T00:00:00.000Z' },
        { path: '/b', name: 'B', lastOpened: '2026-07-02T00:00:00.000Z' },
      ],
    });
    const back = deserializeSettings(serializeSettings(s).content);
    expect(back.recentVaults).toEqual(s.recentVaults);
  });
});

// ─── Project folders ──────────────────────────────────────────────

describe('Project folders serialization', () => {
  it('round-trips folders (deletedAt excluded on read, soft-deleted ones filtered out)', () => {
    const parent = makeFolder({ id: 'f-parent', name: SPECIAL_CHARS, parentFolderId: null });
    const child = makeFolder({ id: 'f-child', name: NON_ASCII, parentFolderId: 'f-parent' });
    const deleted = makeFolder({ id: 'f-deleted', deletedAt: '2026-07-01T00:00:00.000Z' });

    const { path, content } = serializeFolders([parent, child, deleted]);
    expect(path).toBe('folders.json');

    const back = deserializeFolders(content);
    expect(back.map(f => f.id)).toEqual(['f-parent', 'f-child']); // deleted one filtered out
    expect('deletedAt' in back[0]).toBe(false);
    const { deletedAt, ...expected } = parent;
    expect(back[0]).toEqual(expected);
    expect(back[1].name).toBe(NON_ASCII);
    expect(back[1].parentFolderId).toBe('f-parent');
  });

  it(
    'normalized in Phase 3.1b: serializeFolders now strips `deletedAt` via omitDeleted(), ' +
      'like every other serializer, instead of writing a surviving folder\'s `deletedAt: null` ' +
      'into folders.json verbatim. deserializeFolders already tolerated the key being present ' +
      'or absent, so this is a write-side-only change — no read-side behavior moved.',
    () => {
      const folder = makeFolder();
      const { content } = serializeFolders([folder]);
      const parsed = JSON.parse(content);
      expect('deletedAt' in parsed[0]).toBe(false);
    },
  );
});
