import './testSupport';

import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity, InboxItem, Project, ProjectTask, TimeEntry, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { resetDb } from './testSupport';
import { db } from '../db';
import { exportAllToDisk, importAllFromDisk, handleExternalChange, writeEntityToDisk, fileIndex } from './vaultSync';
import { resolveConflicts } from './conflictResolver';
import { readBase, recordBase } from './vaultBase';
import {
  serializeActivity, serializeTimeEntries, serializeProjectTasksFile,
  serializeInbox, deserializeInbox, serializeSettings,
} from './serializers';
import { stringifyFrontmatter } from './frontmatter';
import { PROJECT_TASKS, TIME_LOG, INBOX, SETTINGS } from './vaultLayout';
import { MemoryBackend } from './memoryBackend';

beforeEach(async () => {
  await resetDb();
});

const T0 = '2026-07-01T00:00:00.000Z';
const T1 = '2026-07-15T00:00:00.000Z';
const T2 = '2026-07-20T00:00:00.000Z';
const ACTIVITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ENTRY_E1_ID = '555555000000000000000000000005';
const ENTRY_E2_ID = '666666000000000000000000000006';
const PROJECT_CORRUPT_ID = 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1';
const PROJECT_FINE_ID = 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2';
const TASK_FINE_ID = 'c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3';
const INBOX_ITEM_ID = 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4';

function buildActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: ACTIVITY_ID,
    name: 'Real Activity',
    color: '#E04848',
    dailyBudgetMinutes: 60,
    isBreak: false,
    sortOrder: 0,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    deviceId: 'device-a',
    ...overrides,
  };
}

function buildTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-default',
    activityId: 'activity-default',
    startedAt: T0,
    endedAt: T0,
    durationSeconds: 60,
    isManual: true,
    date: '2026-07-15',
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    deviceId: 'device-a',
    ...overrides,
  };
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-default',
    name: 'Project',
    description: '',
    color: '#2BA89E',
    icon: '',
    sortOrder: 0,
    isArchived: false,
    folderId: null,
    linkedActivityId: null,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    deviceId: 'device-a',
    ...overrides,
  };
}

function buildTask(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: 'task-default',
    projectId: 'proj-default',
    title: 'Task',
    sortOrder: 0,
    isCompleted: false,
    completedAt: null,
    archivedAt: null,
    recurrenceRule: null,
    lastRecurredDate: null,
    timeBox: 'later',
    scheduledDate: null,
    timeBoxOrder: 0,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    deviceId: 'device-a',
    ...overrides,
  };
}

function buildSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: 'default',
    ...DEFAULT_SETTINGS,
    updatedAt: T0,
    deviceId: 'device-a',
    ...overrides,
  };
}

function buildInboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: INBOX_ITEM_ID,
    text: 'Buy milk',
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    deviceId: 'device-a',
    ...overrides,
  };
}

/** `<stem>.sync-conflict-<date>-<time>-<device><ext>`, next to `path`. */
function siblingConflictPath(path: string, ext: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const stem = path.slice(dir.length, path.length - ext.length);
  return `${dir}${stem}.sync-conflict-20260801-120000-DEV${ext}`;
}

describe('exportAllToDisk — vault.json marker', () => {
  it('writes vault.json on first export', async () => {
    const backend = new MemoryBackend();

    await exportAllToDisk(backend);

    expect(await backend.exists('vault.json')).toBe(true);
  });

  it('leaves vault.json byte-identical across two consecutive exports', async () => {
    const backend = new MemoryBackend();

    await exportAllToDisk(backend);
    const first = await backend.readFile('vault.json');

    await exportAllToDisk(backend);
    const second = await backend.readFile('vault.json');

    expect(second).toBe(first);
  });

  it('does not rewrite a pre-existing vault.json with old-style content', async () => {
    const backend = new MemoryBackend();
    const oldStyle = JSON.stringify({ version: 1, exportedAt: '2026-01-01T00:00:00.000Z' }, null, 2) + '\n';
    await backend.writeFile('vault.json', oldStyle);

    await exportAllToDisk(backend);

    expect(await backend.readFile('vault.json')).toBe(oldStyle);
  });
});

describe('resolveConflicts — vault.json conflict copies', () => {
  it('deletes a vault.json conflict copy, reports it resolved, and leaves vault.json untouched', async () => {
    const backend = new MemoryBackend();
    await exportAllToDisk(backend);
    const before = await backend.readFile('vault.json');
    const conflictPath = 'vault.sync-conflict-20260801-120000-ABCDEFG.json';
    await backend.writeFile(conflictPath, JSON.stringify({ version: 1, exportedAt: '2025-01-01T00:00:00.000Z' }, null, 2) + '\n');

    const results = await resolveConflicts(backend);

    expect(await backend.exists(conflictPath)).toBe(false);
    expect(results).toContainEqual(expect.objectContaining({
      conflictPath,
      targetPath: 'vault.json',
      resolved: true,
      added: 0,
      removed: 0,
    }));
    expect(await backend.readFile('vault.json')).toBe(before);
  });
});

describe('importAllFromDisk — conflict copies (C8)', () => {
  it('skips a sync-conflict copy sitting next to a real activity file', async () => {
    const backend = new MemoryBackend();
    const real = buildActivity({ updatedAt: T0 });
    const { path, content } = serializeActivity(real);
    await backend.writeFile(path, content);

    // Newer updatedAt + different name: if this were imported as an ordinary
    // file it would win the LWW merge against the real row (same id), so a
    // surviving 'Real Activity' name is proof the copy was skipped, not just
    // that it happened to lose.
    const conflictPath = siblingConflictPath(path, '.md');
    const theirs = buildActivity({ name: 'From Conflict', updatedAt: T1 });
    await backend.writeFile(conflictPath, serializeActivity(theirs).content);

    const result = await importAllFromDisk(backend);

    expect(result.errors).toEqual([]);
    const stored = await db.activities.get(ACTIVITY_ID);
    expect(stored).toBeTruthy();
    expect(stored!.name).toBe('Real Activity');

    expect(await readBase(conflictPath)).toBeNull();
    expect(await readBase(path)).toBe(content);

    expect(fileIndex.getPath(ACTIVITY_ID)).toBe(path);
  });
});

describe('handleExternalChange — conflict copies (C8)', () => {
  it('leaves Dexie untouched for a modify event on a conflict-copy path', async () => {
    const backend = new MemoryBackend();
    const real = buildActivity({ updatedAt: T0 });
    const { path, content } = serializeActivity(real);
    await backend.writeFile(path, content);
    await db.activities.put(real);
    fileIndex.set(ACTIVITY_ID, path);

    // Deliberately never written to the backend: if the guard is missing,
    // handleExternalChange would try to read it and throw "File not found"
    // instead of silently no-op'ing.
    const conflictPath = siblingConflictPath(path, '.md');

    await expect(handleExternalChange(backend, conflictPath, 'modify')).resolves.toBeUndefined();

    const stored = await db.activities.get(ACTIVITY_ID);
    expect(stored).toBeTruthy();
    expect(stored!.name).toBe('Real Activity');
    expect(stored!.updatedAt).toBe(T0);
    expect(await readBase(conflictPath)).toBeNull();
    expect(fileIndex.getId(conflictPath)).toBeUndefined();
  });
});

describe('importAllFromDisk — deletion inferred from base (C12)', () => {
  it('soft-deletes a row that a peer removed from a rewritten date file, and the next export does not resurrect it', async () => {
    const backend = new MemoryBackend();
    const date = '2026-07-15';
    const activityNames = new Map<string, string>();

    const e1 = buildTimeEntry({ id: ENTRY_E1_ID, date, updatedAt: T0 });
    const e2 = buildTimeEntry({ id: ENTRY_E2_ID, date, updatedAt: T0 });
    await db.timeEntries.bulkPut([e1, e2]);

    // First export: writes the date file with both entries and records the
    // base both devices now agree on.
    await exportAllToDisk(backend);
    const path = TIME_LOG.buildPath(date);
    const exported = await backend.readFile(path);
    expect(exported).toContain(ENTRY_E1_ID);
    expect(exported).toContain(ENTRY_E2_ID);

    // The peer device deleted E2 locally and its own export rewrote the file
    // with only E1 — real serializer, no hand-written frontmatter.
    const peerContent = serializeTimeEntries(date, [e1], activityNames).content;
    await backend.writeFile(path, peerContent);

    const result = await importAllFromDisk(backend);
    expect(result.errors).toEqual([]);

    // Existence-first: a missing row and a soft-deleted row are both falsy on
    // `.deletedAt`, so assert the row was found before checking its state.
    const storedE1 = await db.timeEntries.get(ENTRY_E1_ID);
    expect(storedE1).toBeTruthy();
    expect(storedE1!.deletedAt).toBeFalsy();

    const storedE2 = await db.timeEntries.get(ENTRY_E2_ID);
    expect(storedE2).toBeTruthy();
    expect(storedE2!.deletedAt).toBeTruthy();

    // No resurrection: exporting again must not bring E2 back into the file.
    await exportAllToDisk(backend);
    const afterExport = await backend.readFile(path);
    expect(afterExport).toContain(ENTRY_E1_ID);
    expect(afterExport).not.toContain(ENTRY_E2_ID);
  });

  it('keeps a row the peer file has that the base never recorded, instead of treating it as deleted', async () => {
    const backend = new MemoryBackend();
    const date = '2026-07-16';
    const activityNames = new Map<string, string>();

    const e1 = buildTimeEntry({ id: ENTRY_E1_ID, date, updatedAt: T0 });
    await db.timeEntries.put(e1);
    await exportAllToDisk(backend); // base recorded for the E1-only file

    const path = TIME_LOG.buildPath(date);
    // Peer added a brand-new entry: base never had it, so its absence from
    // our own prior state is not what proves deletion — its presence here
    // must be honored as new, active data.
    const e2 = buildTimeEntry({ id: ENTRY_E2_ID, date, updatedAt: T0 });
    const peerContent = serializeTimeEntries(date, [e1, e2], activityNames).content;
    await backend.writeFile(path, peerContent);

    const result = await importAllFromDisk(backend);
    expect(result.errors).toEqual([]);

    const storedE2 = await db.timeEntries.get(ENTRY_E2_ID);
    expect(storedE2).toBeTruthy();
    expect(storedE2!.deletedAt).toBeFalsy();
  });

  it('infers nothing for a path with no recorded base (fresh import, union-keeps preserved)', async () => {
    const backend = new MemoryBackend();
    const date = '2026-07-17';
    const activityNames = new Map<string, string>();

    // A row already local (e.g. from a prior local-only session) that this
    // date file's on-disk content has never mentioned.
    const e2 = buildTimeEntry({ id: ENTRY_E2_ID, date, updatedAt: T0 });
    await db.timeEntries.put(e2);

    const path = TIME_LOG.buildPath(date);
    const e1 = buildTimeEntry({ id: ENTRY_E1_ID, date, updatedAt: T0 });
    await backend.writeFile(path, serializeTimeEntries(date, [e1], activityNames).content);

    expect(await readBase(path)).toBeNull();

    const result = await importAllFromDisk(backend);
    expect(result.errors).toEqual([]);

    const storedE2 = await db.timeEntries.get(ENTRY_E2_ID);
    expect(storedE2).toBeTruthy();
    expect(storedE2!.deletedAt).toBeFalsy();
  });
});

describe('importAllFromDisk — prune guard on partial failure (C12)', () => {
  it('does not evict another path\'s recorded base when a different path in the same kind fails to parse', async () => {
    const backend = new MemoryBackend();

    // "AAA Corrupt" sorts before "ZZZ Fine" (MemoryBackend.listDirs returns
    // sorted paths), so its tasks.md is read first and its throw aborts the
    // rest of projectTasks' per-path loop before ZZZ Fine's tasks.md is ever
    // reached this run.
    // A wholly unrelated kind that succeeds, so `total > 0` and import's
    // "everything failed" guard (`total === 0 && errors.length > 0`) doesn't
    // throw before returning — orthogonal to the prune guard under test here.
    const real = buildActivity({ updatedAt: T0 });
    const activityFile = serializeActivity(real);
    await backend.writeFile(activityFile.path, activityFile.content);

    const corruptProject = buildProject({ id: PROJECT_CORRUPT_ID, name: 'AAA Corrupt' });
    const corruptPath = PROJECT_TASKS.buildPath(corruptProject.name, corruptProject.id);
    // Valid frontmatter delimiters — parseFrontmatter never throws on bad
    // YAML — but `tasks` is not an array, so deserializeProjectTasks's
    // `.map` call throws a TypeError instead of quietly returning `[]`. Same
    // trigger as conflictResolver.e2e.test.ts's C7 regression case.
    const corruptContent = stringifyFrontmatter({ projectId: corruptProject.id, updatedAt: T0, tasks: 42 }, '');
    await backend.writeFile(corruptPath, corruptContent);

    const fineProject = buildProject({ id: PROJECT_FINE_ID, name: 'ZZZ Fine' });
    const fineTask = buildTask({ id: TASK_FINE_ID, projectId: PROJECT_FINE_ID, updatedAt: T0 });
    const finePath = PROJECT_TASKS.buildPath(fineProject.name, fineProject.id);
    const fineContent = serializeProjectTasksFile(fineProject, [fineTask]).content;
    await backend.writeFile(finePath, fineContent);
    // Simulates a prior successful sync: this path's base is already agreed.
    await recordBase(finePath, fineContent);

    const result = await importAllFromDisk(backend);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('projectTasks'))).toBe(true);

    // Without the guard, pruneBases(seen) still runs after the loop and
    // "ZZZ Fine"'s tasks.md — never reached this run because "AAA Corrupt"'s
    // throw aborted the loop first — is missing from `seen`, so its base
    // gets wrongly forgotten even though the file itself is untouched.
    expect(await readBase(finePath)).toBe(fineContent);
  });
});

describe('INBOX_KIND — inbox.md persists as an empty list (C13)', () => {
  it('deleting the last item leaves inbox.md on disk as an empty list rather than deleting it', async () => {
    const backend = new MemoryBackend();
    const item = buildInboxItem();
    await db.inboxItems.put(item);

    await exportAllToDisk(backend);
    const exported = await backend.readFile(INBOX.path);
    expect(exported).toContain(item.id);

    // Soft-delete the only item, then run the same write path a dexieHooks
    // 'updating' callback would trigger.
    await db.inboxItems.update(item.id, { deletedAt: T1, updatedAt: T1 });
    await writeEntityToDisk(backend, 'inboxItems', item.id);

    // Before this fix, gatherWriteSet returned inbox.md in `deletes` once no
    // *active* item remained, deleting the file outright.
    expect(await backend.exists(INBOX.path)).toBe(true);
    const content = await backend.readFile(INBOX.path);
    expect(deserializeInbox(content)).toEqual([]);
  });

  it('a peer importing the resulting empty file soft-deletes its own row, and a following export does not resurrect it', async () => {
    const backend = new MemoryBackend();
    const item = buildInboxItem();
    await db.inboxItems.put(item);
    // Base recorded from the one-item file both devices agreed on.
    await exportAllToDisk(backend);

    // The other device deleted its last item; per this fix, its own write
    // path persisted inbox.md as a valid empty-items file instead of
    // deleting it — simulated directly with the real serializer.
    await backend.writeFile(INBOX.path, serializeInbox([]).content);

    const result = await importAllFromDisk(backend);
    expect(result.errors).toEqual([]);

    // Existence-first: a missing row and a soft-deleted row are both falsy
    // on `.deletedAt`, so assert the row was found before checking its state.
    const stored = await db.inboxItems.get(item.id);
    expect(stored).toBeTruthy();
    expect(stored!.deletedAt).toBeTruthy();

    // C12's base-diff inference is what actually soft-deletes the row above;
    // what this fix contributes is that inbox.md exists at all for import to
    // read in the first place. Without it, the deleting device's own export
    // removes the file, so this peer never sees a change to react to and its
    // own next export resurrects the item instead.
    await exportAllToDisk(backend);
    const afterExport = await backend.readFile(INBOX.path);
    expect(afterExport).not.toContain(item.text);
  });

  it('a never-used inbox does not write inbox.md on export', async () => {
    const backend = new MemoryBackend();

    await exportAllToDisk(backend);

    expect(await backend.exists(INBOX.path)).toBe(false);
  });
});

describe('SETTINGS_KIND.mergeRow — external merge honors updatedAt (C14)', () => {
  it('ignores a stale external settings.json when local settings are newer', async () => {
    const backend = new MemoryBackend();
    const local = buildSettings({ dayStartHour: 4, updatedAt: T2 });
    await db.settings.put(local);

    // A file arriving late (e.g. delivered out of order by Syncthing) with an
    // older updatedAt and a different value — before this fix, the external
    // source did an unconditional put and this stale value would clobber the
    // newer local row.
    const stale = buildSettings({ dayStartHour: 9, updatedAt: T1 });
    await backend.writeFile(SETTINGS.path, serializeSettings(stale).content);

    await handleExternalChange(backend, SETTINGS.path, 'modify');

    const stored = await db.settings.get('default');
    expect(stored).toBeTruthy();
    expect(stored!.dayStartHour).toBe(4);
    expect(stored!.updatedAt).toBe(T2);
  });

  it('applies a newer external settings.json over stale local settings', async () => {
    const backend = new MemoryBackend();
    const local = buildSettings({ dayStartHour: 4, updatedAt: T1 });
    await db.settings.put(local);

    const fresh = buildSettings({ dayStartHour: 9, updatedAt: T2 });
    await backend.writeFile(SETTINGS.path, serializeSettings(fresh).content);

    await handleExternalChange(backend, SETTINGS.path, 'modify');

    const stored = await db.settings.get('default');
    expect(stored).toBeTruthy();
    expect(stored!.dayStartHour).toBe(9);
    expect(stored!.updatedAt).toBe(T2);
  });

  it('leaves Dexie byte-identical when the watcher re-observes the file the app just wrote', async () => {
    const backend = new MemoryBackend();
    const local = buildSettings({ dayStartHour: 7, updatedAt: T1 });
    await db.settings.put(local);

    // Simulate the app's own write reaching disk, then the file watcher
    // re-observing that same file — a self-write re-import loop. Its
    // updatedAt equals the stored row's, so strict `>` must not re-apply it.
    await writeEntityToDisk(backend, 'settings', 'default');
    await handleExternalChange(backend, SETTINGS.path, 'modify');

    const stored = await db.settings.get('default');
    expect(stored).toEqual(local);
  });
});
