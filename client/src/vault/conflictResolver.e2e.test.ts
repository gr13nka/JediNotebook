import './testSupport';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, ProjectTask, TimeEntry, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { resetDb } from './testSupport';
import { db, snapshotAllTables } from '../db';
import { MemoryBackend } from './memoryBackend';
import { resolveConflicts, conflictTargetPath } from './conflictResolver';
import { importAllFromDisk } from './vaultSync';
import { recordBase, readBase } from './vaultBase';
import { serializeProjectFile, serializeProjectTasksFile, serializeSettings, serializeTimeEntries } from './serializers';
import { stringifyFrontmatter } from './frontmatter';
import { PROJECTS, PROJECT_TASKS, TIME_LOG } from './vaultLayout';

/**
 * End-to-end coverage of `resolveConflicts`/`resolveOne` — the orchestration
 * (backend reads, Dexie writes, copy deletion, base recording) that
 * `conflictResolver.test.ts` (planMerge, pure) and `threeWayMerge.test.ts`
 * (merge algorithms, pure) don't exercise on their own. Runs against
 * `MemoryBackend` + fake-indexeddb (`testSupport.ts`), and always produces
 * on-disk bytes through the real serializers — never hand-written
 * frontmatter/JSON — so a scenario also pins format fidelity.
 *
 * Fix-tasks C7-C16 extend this suite with regression scenarios. Add new
 * `it(...)` blocks to the single `describe` below rather than opening a new
 * one, and call `expectResolvedQuiescent` at the end of each.
 */

// Fixed device-id-looking hex ids: the first 6 hex chars (after dashes are
// stripped) become the vault directory's short id via `entityFilename` /
// `shortId`, and must stay `[a-f0-9]{6}` for `extractNameFromDirName` to
// round-trip the encoded directory name cleanly.
const PROJECT_ALPHA_ID = 'aaaaaa0000000000000000000000a1';
const PROJECT_BETA_ID = 'bbbbbb0000000000000000000000b1';
const PROJECT_GAMMA_ID = 'cccccc0000000000000000000000c1';
const PROJECT_DELTA_ID = 'dddddd0000000000000000000000d1';
const PROJECT_GHOST_ID = 'eeeeee0000000000000000000000e1';
const PROJECT_EPSILON_ID = 'ababab0000000000000000000000a5';
const PROJECT_ZETA_ID = 'cdcdcd0000000000000000000000a6';
const PROJECT_ETA_ID = 'efefef0000000000000000000000e7';
const PROJECT_THETA_ID = '070707000000000000000000000008';
const TASK_T1_ID = '111111000000000000000000000001';
const TASK_T2_ID = '222222000000000000000000000002';
const TASK_X_ID = '333333000000000000000000000003';
const TASK_Y_ID = '444444000000000000000000000004';
const ENTRY_E1_ID = '555555000000000000000000000005';
const ENTRY_E2_ID = '666666000000000000000000000006';

const T0 = '2026-07-01T00:00:00.000Z';
const T1 = '2026-07-15T00:00:00.000Z';
const T2 = '2026-07-20T00:00:00.000Z';

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

function buildSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: 'default',
    ...DEFAULT_SETTINGS,
    updatedAt: T0,
    deviceId: 'device-a',
    ...overrides,
  };
}

/** `<stem>.sync-conflict-<date>-<time>-<device><ext>`, next to the target. */
function conflictCopyName(stem: string, ext: string): string {
  return `${stem}.sync-conflict-20260801-120000-YZWMYOO${ext}`;
}

describe('resolveConflicts — end-to-end orchestration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await resetDb();
    // resolveConflicts logs a `[vault] conflicts: ...` summary whenever it
    // resolves anything. Silenced here (test-only) rather than in
    // production code, per this task's brief.
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  /**
   * Shared post-condition every scenario below must leave true:
   *  1. no conflict-copy-named file remains on the backend.
   *  2. running `resolveConflicts` again is a no-op.
   *
   * Base-freshness and import-convergence are a separate, opt-in check —
   * `expectMergedTargetPersisted` below — since not every scenario resolves
   * a target worth checking (a failed resolution never rewrites; the union
   * and ghost-dir scenarios already assert their on-disk content inline).
   */
  async function expectResolvedQuiescent(backend: MemoryBackend): Promise<void> {
    const remainingConflicts = [...backend.getAll().keys()].filter(
      path => conflictTargetPath(path) !== null,
    );
    expect(remainingConflicts).toEqual([]);

    const second = await resolveConflicts(backend);
    expect(second).toEqual([]);
  }

  /**
   * C11: proves a merged target actually reached disk, not just Dexie — its
   * recorded base already matches the fresh bytes (no debounced write needed
   * to catch either up), and reimporting from that exact state leaves every
   * entity table unchanged (nothing left to reconcile). `vaultBase` itself is
   * excluded from the convergence comparison: `importAllFromDisk` calls
   * `recordBase` unconditionally for every path it reads, which legitimately
   * bumps `recordedAt` again even though the content doesn't change.
   *
   * Returns the on-disk bytes so a scenario can still assert on their
   * specific content (a renamed title present, a deleted row's id absent).
   */
  async function expectMergedTargetPersisted(backend: MemoryBackend, targetPath: string): Promise<string> {
    expect(await backend.exists(targetPath)).toBe(true);
    const onDisk = await backend.readFile(targetPath);
    expect(await readBase(targetPath)).toBe(onDisk);

    const before = await snapshotAllTables();
    before.delete('vaultBase');
    await importAllFromDisk(backend);
    const after = await snapshotAllTables();
    after.delete('vaultBase');
    expect(after).toEqual(before);

    return onDisk;
  }

  it('merges a project description three-way (textField) and rewrites project.md', async () => {
    const backend = new MemoryBackend();
    const name = 'Alpha';
    const targetPath = PROJECTS.buildPath(name, PROJECT_ALPHA_ID);
    const dir = PROJECTS.buildDirPath(name, PROJECT_ALPHA_ID);
    const conflictPath = `${dir}/${conflictCopyName('project', '.md')}`;

    const ancestor = buildProject({ id: PROJECT_ALPHA_ID, name, description: 'Общее', updatedAt: T0 });
    await recordBase(targetPath, serializeProjectFile(ancestor).content);

    const ours = buildProject({ id: PROJECT_ALPHA_ID, name, description: 'Общее\n\nFrom A', updatedAt: T1 });
    await db.projects.put(ours);
    await backend.writeFile(targetPath, serializeProjectFile(ours).content);

    // Newer updatedAt than ours, so LWW picks theirs as the winning row —
    // the merged body must still contain both paragraphs regardless.
    const theirs = buildProject({ id: PROJECT_ALPHA_ID, name, description: 'Общее\n\nFrom B', updatedAt: T2 });
    await backend.writeFile(conflictPath, serializeProjectFile(theirs).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath, resolved: true });

    const stored = await db.projects.get(PROJECT_ALPHA_ID);
    expect(stored?.description).toContain('From A');
    expect(stored?.description).toContain('From B');

    // Entity-scoped kinds (projects) rewrite the merged result to disk
    // immediately, so the target file — not just Dexie — carries both sides.
    const onDisk = await backend.readFile(targetPath);
    expect(onDisk).toContain('From A');
    expect(onDisk).toContain('From B');
    expect(await readBase(targetPath)).toBe(onDisk);

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('resolves tasks.md rows by LWW and soft-deletes a base-proven removal', async () => {
    const backend = new MemoryBackend();
    const name = 'Beta';
    const project = buildProject({ id: PROJECT_BETA_ID, name });
    // C11's rewrite delegates a task's write-set to its parent project
    // (PROJECT_TASKS_KIND.gatherWriteSet -> PROJECTS_KIND.gatherWriteSet),
    // which needs the project row in Dexie — true of every real project a
    // task can belong to, so the fixture must persist it too.
    await db.projects.put(project);
    const targetPath = PROJECT_TASKS.buildPath(name, PROJECT_BETA_ID);
    const dir = PROJECT_TASKS.buildDirPath(name, PROJECT_BETA_ID);
    const conflictPath = `${dir}/${conflictCopyName('tasks', '.md')}`;

    const t1Ancestor = buildTask({ id: TASK_T1_ID, projectId: PROJECT_BETA_ID, title: 'Task One', sortOrder: 0, updatedAt: T0 });
    const t2Ancestor = buildTask({ id: TASK_T2_ID, projectId: PROJECT_BETA_ID, title: 'Task Two', sortOrder: 1, updatedAt: T0 });
    await recordBase(targetPath, serializeProjectTasksFile(project, [t1Ancestor, t2Ancestor]).content);

    const t1Ours = buildTask({ id: TASK_T1_ID, projectId: PROJECT_BETA_ID, title: 'Task One', sortOrder: 0, updatedAt: T1 });
    const t2Ours = buildTask({ id: TASK_T2_ID, projectId: PROJECT_BETA_ID, title: 'Task Two', sortOrder: 1, updatedAt: T0 });
    await db.projectTasks.bulkPut([t1Ours, t2Ours]);
    await backend.writeFile(targetPath, serializeProjectTasksFile(project, [t1Ours, t2Ours]).content);

    // Newer updatedAt + changed title for T1; T2 dropped entirely (base
    // proves it existed, so its absence here is a deletion, not a union).
    const t1Theirs = buildTask({ id: TASK_T1_ID, projectId: PROJECT_BETA_ID, title: 'Task One Renamed', sortOrder: 0, updatedAt: T2 });
    await backend.writeFile(conflictPath, serializeProjectTasksFile(project, [t1Theirs]).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath, resolved: true });

    const storedT1 = await db.projectTasks.get(TASK_T1_ID);
    expect(storedT1?.title).toBe('Task One Renamed');

    const storedT2 = await db.projectTasks.get(TASK_T2_ID);
    expect(storedT2?.deletedAt).toBeTruthy();

    expect(await backend.exists(conflictPath)).toBe(false);

    // PROJECT_TASKS_KIND.parseFile returns no `entityId` (tasks.md aggregates
    // a whole project's tasks rather than naming one entity), but C11 made
    // resolveOne's rewrite-to-disk step fall back to a surviving row's id —
    // any row id in tasks.md resolves the same file — so the merged content
    // still reaches disk immediately, same as an entity-scoped kind.
    const onDisk = await expectMergedTargetPersisted(backend, targetPath);
    expect(onDisk).toContain('Task One Renamed');
    expect(onDisk).not.toContain('Task Two');

    await expectResolvedQuiescent(backend);
  });

  it('soft-deletes a base-proven removal from a time-log day file (C10)', async () => {
    const backend = new MemoryBackend();
    const date = '2026-07-15';
    const targetPath = TIME_LOG.buildPath(date);
    const conflictPath = `${TIME_LOG.dir}/${conflictCopyName(date, '.md')}`;
    const activityNames = new Map<string, string>();

    const e1Ancestor = buildTimeEntry({ id: ENTRY_E1_ID, date, updatedAt: T0 });
    const e2Ancestor = buildTimeEntry({ id: ENTRY_E2_ID, date, updatedAt: T0 });
    await recordBase(targetPath, serializeTimeEntries(date, [e1Ancestor, e2Ancestor], activityNames).content);

    const e1Ours = buildTimeEntry({ id: ENTRY_E1_ID, date, updatedAt: T0 });
    const e2Ours = buildTimeEntry({ id: ENTRY_E2_ID, date, updatedAt: T0 });
    await db.timeEntries.bulkPut([e1Ours, e2Ours]);
    await backend.writeFile(targetPath, serializeTimeEntries(date, [e1Ours, e2Ours], activityNames).content);

    // The other device's file no longer has E2 at all: base proves it
    // existed, so its absence here is a deletion, not a union.
    const e1Theirs = buildTimeEntry({ id: ENTRY_E1_ID, date, updatedAt: T0 });
    await backend.writeFile(conflictPath, serializeTimeEntries(date, [e1Theirs], activityNames).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath, resolved: true });

    // Assert existence before `.deletedAt` — see the union-fallback scenario
    // below for why a plain falsy check on the row itself isn't enough.
    const storedE1 = await db.timeEntries.get(ENTRY_E1_ID);
    expect(storedE1).toBeTruthy();
    expect(storedE1!.deletedAt).toBeFalsy();

    const storedE2 = await db.timeEntries.get(ENTRY_E2_ID);
    expect(storedE2).toBeTruthy();
    expect(storedE2!.deletedAt).toBeTruthy();

    expect(await backend.exists(conflictPath)).toBe(false);

    // TIME_LOG_KIND.parseFile returns no `entityId` (a date file aggregates a
    // whole day's entries rather than naming one entity), but C11's fallback
    // to a surviving row's id (E1's) resolves the same date file, so the
    // merged content still reaches disk immediately.
    const onDisk = await expectMergedTargetPersisted(backend, targetPath);
    expect(onDisk).toContain(ENTRY_E1_ID);
    expect(onDisk).not.toContain(ENTRY_E2_ID);

    await expectResolvedQuiescent(backend);
  });

  it('unions rows from both sides when no base has ever been recorded', async () => {
    const backend = new MemoryBackend();
    const name = 'Gamma';
    const project = buildProject({ id: PROJECT_GAMMA_ID, name });
    const targetPath = PROJECT_TASKS.buildPath(name, PROJECT_GAMMA_ID);
    const dir = PROJECT_TASKS.buildDirPath(name, PROJECT_GAMMA_ID);
    const conflictPath = `${dir}/${conflictCopyName('tasks', '.md')}`;

    // No recordBase call: the "nothing agreed yet" case — a plain union,
    // since no deletion can be proven from a base that doesn't exist.

    const x = buildTask({ id: TASK_X_ID, projectId: PROJECT_GAMMA_ID, title: 'X Task', sortOrder: 0, updatedAt: T0 });
    await db.projectTasks.put(x);
    await backend.writeFile(targetPath, serializeProjectTasksFile(project, [x]).content);

    const y = buildTask({ id: TASK_Y_ID, projectId: PROJECT_GAMMA_ID, title: 'Y Task', sortOrder: 0, updatedAt: T0 });
    await backend.writeFile(conflictPath, serializeProjectTasksFile(project, [y]).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath, resolved: true, unionFallback: true });

    const storedX = await db.projectTasks.get(TASK_X_ID);
    const storedY = await db.projectTasks.get(TASK_Y_ID);
    // Assert existence before `.deletedAt` — `undefined?.deletedAt` is also
    // falsy, so a plain `toBeFalsy()` here would pass even if the row never
    // made it into Dexie at all.
    expect(storedX).toBeTruthy();
    expect(storedY).toBeTruthy();
    expect(storedX!.deletedAt).toBeFalsy();
    expect(storedY!.deletedAt).toBeFalsy();

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('discovers and resolves a root-level settings.json conflict copy', async () => {
    const backend = new MemoryBackend();
    // Settings is a root singleton — no directory of its own. This pins that
    // root-level conflict copies are discovered at all: the production bug
    // fixed in C3 kept this scan from ever running on real devices.
    const conflictPath = conflictCopyName('settings', '.json');

    const seeded = buildSettings({ dayStartHour: 4, updatedAt: T0 });
    await db.settings.put(seeded);
    await backend.writeFile('settings.json', serializeSettings(seeded).content);

    const theirs = buildSettings({ dayStartHour: 9, updatedAt: T2 });
    await backend.writeFile(conflictPath, serializeSettings(theirs).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath: 'settings.json', resolved: true });

    // Settings rows have no `id` field on disk (deserializeSettings never
    // produces one), so resolveOne's keyed-row merge path doesn't apply here —
    // it takes the non-keyed branch's field-wise merge (C16) instead. Only
    // one field differs in this fixture, so a whole-row LWW swap would have
    // picked the same winner; the scenario below exercises the case where
    // that distinction actually matters.
    const stored = await db.settings.get('default');
    expect(stored?.dayStartHour).toBe(9);

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('rewrites settings.json to disk and records its base after resolving a conflict (C11)', async () => {
    const backend = new MemoryBackend();
    const conflictPath = conflictCopyName('settings', '.json');

    const seeded = buildSettings({ dayStartHour: 4, updatedAt: T0 });
    await db.settings.put(seeded);
    await backend.writeFile('settings.json', serializeSettings(seeded).content);

    const theirs = buildSettings({ dayStartHour: 9, updatedAt: T2 });
    await backend.writeFile(conflictPath, serializeSettings(theirs).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath: 'settings.json', resolved: true });

    // Settings has no row `id` on disk, so it takes resolveOne's non-keyed
    // branch — here the field-wise merge (C16), since target and copy each
    // parse to exactly one row and no base was recorded. That branch must
    // reach disk and record a fresh base too, same as the keyed branches.
    const onDisk = await expectMergedTargetPersisted(backend, 'settings.json');
    expect(onDisk).toContain('"dayStartHour": 9');

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('merges settings.json field-wise, keeping different fields changed on each side (C16)', async () => {
    const backend = new MemoryBackend();
    const conflictPath = conflictCopyName('settings', '.json');

    const ancestor = buildSettings({ dayStartHour: 6, maxTasksPerProject: 5, updatedAt: T0 });
    await recordBase('settings.json', serializeSettings(ancestor).content);

    // Ours changed dayStartHour only.
    const ours = buildSettings({ dayStartHour: 9, maxTasksPerProject: 5, updatedAt: T1 });
    await db.settings.put(ours);
    await backend.writeFile('settings.json', serializeSettings(ours).content);

    // The conflict copy changed a DIFFERENT field, with a newer updatedAt
    // than ours. Whole-object LWW picks this row outright and silently
    // drops ours's dayStartHour change — the bug this task fixes.
    const theirs = buildSettings({ dayStartHour: 6, maxTasksPerProject: 8, updatedAt: T2 });
    await backend.writeFile(conflictPath, serializeSettings(theirs).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath: 'settings.json', resolved: true });

    const stored = await db.settings.get('default');
    expect(stored?.dayStartHour).toBe(9);
    expect(stored?.maxTasksPerProject).toBe(8);
    // The merged row must outrank both inputs' updatedAt so the merge
    // propagates to both other devices instead of losing to either one's
    // still-equal-or-older local row.
    expect(stored!.updatedAt > T2).toBe(true);
    expect(stored!.updatedAt > T1).toBe(true);

    const onDisk = await expectMergedTargetPersisted(backend, 'settings.json');
    expect(onDisk).toContain('"dayStartHour": 9');
    expect(onDisk).toContain('"maxTasksPerProject": 8');

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('falls back to whole-row LWW when no target file exists yet to merge against (C16)', async () => {
    const backend = new MemoryBackend();
    const conflictPath = conflictCopyName('settings', '.json');

    // No settings.json on disk yet and no Dexie row: this device has never
    // seen settings before. `oursRaw` is null, so `ourRows` parses to `[]`
    // and `canMergeFields` is false — there is no `ours` row to compare
    // against, so the copy's row must simply apply via the pre-C16 LWW
    // hand-off rather than the field-wise merge.
    const theirs = buildSettings({ dayStartHour: 9, updatedAt: T2 });
    await backend.writeFile(conflictPath, serializeSettings(theirs).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath: 'settings.json', resolved: true });

    const stored = await db.settings.get('default');
    expect(stored?.dayStartHour).toBe(9);

    // The C11 rewrite-to-disk step still runs off the LWW branch too.
    const onDisk = await expectMergedTargetPersisted(backend, 'settings.json');
    expect(onDisk).toContain('"dayStartHour": 9');

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('keeps the recorded base after a failed resolution, so a later valid copy can still prove a deletion (C7)', async () => {
    const backend = new MemoryBackend();
    const name = 'Delta';
    const project = buildProject({ id: PROJECT_DELTA_ID, name });
    const targetPath = PROJECT_TASKS.buildPath(name, PROJECT_DELTA_ID);
    const dir = PROJECT_TASKS.buildDirPath(name, PROJECT_DELTA_ID);
    const conflictPath = `${dir}/${conflictCopyName('tasks', '.md')}`;

    const t1 = buildTask({ id: TASK_T1_ID, projectId: PROJECT_DELTA_ID, title: 'Task One', sortOrder: 0, updatedAt: T0 });
    const t2 = buildTask({ id: TASK_T2_ID, projectId: PROJECT_DELTA_ID, title: 'Task Two', sortOrder: 1, updatedAt: T0 });
    const agreedContent = serializeProjectTasksFile(project, [t1, t2]).content;
    await recordBase(targetPath, agreedContent);
    await db.projectTasks.bulkPut([t1, t2]);
    await backend.writeFile(targetPath, agreedContent);

    // Unparseable copy: valid frontmatter delimiters — parseFrontmatter never
    // throws on bad YAML, it swallows the error and falls back to an empty
    // body — but `tasks` is not an array, so deserializeProjectTasks's
    // `.map` call throws a TypeError instead of quietly returning `[]`.
    const unparseable = stringifyFrontmatter({ projectId: PROJECT_DELTA_ID, updatedAt: T0, tasks: 42 }, '');
    await backend.writeFile(conflictPath, unparseable);

    const firstRun = await resolveConflicts(backend);
    const firstResolution = firstRun.find(r => r.conflictPath === conflictPath);
    expect(firstResolution).toBeTruthy();
    expect(firstResolution!.resolved).toBe(false);

    // Regression: resolveConflicts used to call forgetBase for every
    // unresolved result, wiping the three-way ancestor. The copy is left in
    // place for retry by design, so `expectResolvedQuiescent` does not apply
    // between this run and the next — only the base's survival is asserted
    // here.
    expect(await readBase(targetPath)).toBe(agreedContent);
    expect(await backend.exists(conflictPath)).toBe(true);

    // The other device's real edit arrives: T2 is genuinely gone. With the
    // base intact this proves a deletion; with a wiped base (the bug) it
    // would fall back to a union and T2 would survive.
    const t1Theirs = buildTask({ id: TASK_T1_ID, projectId: PROJECT_DELTA_ID, title: 'Task One', sortOrder: 0, updatedAt: T0 });
    await backend.writeFile(conflictPath, serializeProjectTasksFile(project, [t1Theirs]).content);

    const secondRun = await resolveConflicts(backend);
    const secondResolution = secondRun.find(r => r.conflictPath === conflictPath);
    expect(secondResolution).toMatchObject({ targetPath, resolved: true });

    const storedT2 = await db.projectTasks.get(TASK_T2_ID);
    expect(storedT2).toBeTruthy();
    expect(storedT2!.deletedAt).toBeTruthy();

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('scans a per-entity dir that holds only a conflict copy, with no canonical file ever written (C9)', async () => {
    const backend = new MemoryBackend();
    const name = 'Ghost';
    const targetPath = PROJECTS.buildPath(name, PROJECT_GHOST_ID);
    const dir = PROJECTS.buildDirPath(name, PROJECT_GHOST_ID);
    const conflictPath = `${dir}/${conflictCopyName('project', '.md')}`;

    // No Dexie row, no recorded base, and — the point of this scenario — no
    // project.md ever written either: Syncthing delivered only the loser
    // (the winner was renamed away, or never arrived) into this directory.
    // PROJECTS_KIND.discoverPaths only reports a directory once project.md
    // exists there, so conflictDirs relying solely on discoverPaths for
    // nested dirs never sees this directory at all — stranding it.
    const theirs = buildProject({ id: PROJECT_GHOST_ID, name, description: 'From ghost', updatedAt: T1 });
    await backend.writeFile(conflictPath, serializeProjectFile(theirs).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath, resolved: true });

    const stored = await db.projects.get(PROJECT_GHOST_ID);
    expect(stored).toBeTruthy();
    expect(stored!.name).toBe(name);
    expect(stored!.description).toBe('From ghost');

    // Entity-scoped kinds rewrite the merged result to disk immediately —
    // this is what proves the directory was actually scanned, not just that
    // Dexie ended up with the row some other way.
    expect(await backend.exists(targetPath)).toBe(true);
    const onDisk = await backend.readFile(targetPath);
    expect(onDisk).toContain('From ghost');

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });

  it('does not soft-delete a task that moved to another project just because a stale conflict copy still lists it here (CRITICAL 2)', async () => {
    const backend = new MemoryBackend();
    const name = 'Epsilon';
    const project1 = buildProject({ id: PROJECT_EPSILON_ID, name });
    const project2 = buildProject({ id: PROJECT_ZETA_ID, name: 'Zeta' });
    await db.projects.bulkPut([project1, project2]);
    const targetPath = PROJECT_TASKS.buildPath(name, PROJECT_EPSILON_ID);
    const dir = PROJECT_TASKS.buildDirPath(name, PROJECT_EPSILON_ID);
    const conflictPath = `${dir}/${conflictCopyName('tasks', '.md')}`;

    // T1 stays in Epsilon throughout. T2 started in Epsilon (base and the
    // peer's stale conflict copy both still show it there) but this device
    // already applied moveTaskToProject: its live row now belongs to Zeta.
    const stayerAncestor = buildTask({ id: TASK_T1_ID, projectId: PROJECT_EPSILON_ID, title: 'Stays', sortOrder: 0, updatedAt: T0 });
    const movedAncestor = buildTask({ id: TASK_T2_ID, projectId: PROJECT_EPSILON_ID, title: 'Moved', sortOrder: 1, updatedAt: T0 });
    await recordBase(targetPath, serializeProjectTasksFile(project1, [stayerAncestor, movedAncestor]).content);

    // Our own on-disk copy of Epsilon's tasks.md already reflects the move —
    // T2 is gone from it, same as Dexie.
    const stayerOurs = buildTask({ id: TASK_T1_ID, projectId: PROJECT_EPSILON_ID, title: 'Stays', sortOrder: 0, updatedAt: T0 });
    const movedLive = buildTask({ id: TASK_T2_ID, projectId: PROJECT_ZETA_ID, title: 'Moved', sortOrder: 0, updatedAt: T1 });
    await db.projectTasks.bulkPut([stayerOurs, movedLive]);
    await backend.writeFile(targetPath, serializeProjectTasksFile(project1, [stayerOurs]).content);

    // A peer's stale conflict copy of Epsilon's tasks.md hasn't heard about
    // the move yet — it still lists T2 under Epsilon.
    const stayerTheirs = buildTask({ id: TASK_T1_ID, projectId: PROJECT_EPSILON_ID, title: 'Stays', sortOrder: 0, updatedAt: T0 });
    const movedTheirs = buildTask({ id: TASK_T2_ID, projectId: PROJECT_EPSILON_ID, title: 'Moved', sortOrder: 1, updatedAt: T0 });
    await backend.writeFile(conflictPath, serializeProjectTasksFile(project1, [stayerTheirs, movedTheirs]).content);

    const results = await resolveConflicts(backend);

    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath, resolved: true });

    // T2 must survive, untouched, under its new project — not soft-deleted
    // just because the stale conflict copy still shows it under the old one.
    const storedMoved = await db.projectTasks.get(TASK_T2_ID);
    expect(storedMoved).toBeTruthy();
    expect(storedMoved!.deletedAt).toBeFalsy();
    expect(storedMoved!.projectId).toBe(PROJECT_ZETA_ID);

    expect(await backend.exists(conflictPath)).toBe(false);

    const onDisk = await expectMergedTargetPersisted(backend, targetPath);
    expect(onDisk).toContain('Stays');
    expect(onDisk).not.toContain('Moved');

    await expectResolvedQuiescent(backend);
  });

  it('does not soft-delete a task via conflict resolution when its move destination file is already on the backend, even before this device has learned about the move (CRITICAL 2 reopened, resolver path)', async () => {
    const backend = new MemoryBackend();
    const moveSourceName = 'Eta';
    const moveSource = buildProject({ id: PROJECT_ETA_ID, name: moveSourceName });
    const moveTarget = buildProject({ id: PROJECT_THETA_ID, name: 'Theta' });
    await db.projects.bulkPut([moveSource, moveTarget]);
    const filePath = PROJECT_TASKS.buildPath(moveSourceName, PROJECT_ETA_ID);
    const dir = PROJECT_TASKS.buildDirPath(moveSourceName, PROJECT_ETA_ID);
    const conflictPath = `${dir}/${conflictCopyName('tasks', '.md')}`;

    // Base: T1 (stays) and T2 (about to move) both under Eta.
    const stayerAncestor = buildTask({ id: TASK_T1_ID, projectId: PROJECT_ETA_ID, title: 'Stays', sortOrder: 0, updatedAt: T0 });
    const movedAncestor = buildTask({ id: TASK_T2_ID, projectId: PROJECT_ETA_ID, title: 'Moved', sortOrder: 1, updatedAt: T0 });
    await recordBase(filePath, serializeProjectTasksFile(moveSource, [stayerAncestor, movedAncestor]).content);

    // This device hasn't learned about the move yet — resolveConflicts runs
    // BEFORE import in the sync flow, so Dexie's live rows are still
    // pre-move at this point.
    await db.projectTasks.bulkPut([stayerAncestor, movedAncestor]);

    // "ours" (the file currently at the target path) is this device's own
    // unrelated concurrent edit (renaming T1) — it won whatever raw
    // Syncthing byte-race happened, so T2 is still there, pre-move.
    const stayerOurs = buildTask({ id: TASK_T1_ID, projectId: PROJECT_ETA_ID, title: 'Stays Renamed', sortOrder: 0, updatedAt: T1 });
    const movedOurs = buildTask({ id: TASK_T2_ID, projectId: PROJECT_ETA_ID, title: 'Moved', sortOrder: 1, updatedAt: T0 });
    await backend.writeFile(filePath, serializeProjectTasksFile(moveSource, [stayerOurs, movedOurs]).content);

    // "theirs" (the conflict copy) is the peer's ALREADY-moved-away version
    // of Eta's tasks.md — T2 is simply gone from it, which is what makes
    // mergeRowSets conclude (correctly, from ITS point of view) that T2 was
    // deleted: base had it, neither side of THIS FILE's conflict has it.
    const stayerTheirs = buildTask({ id: TASK_T1_ID, projectId: PROJECT_ETA_ID, title: 'Stays', sortOrder: 0, updatedAt: T0 });
    await backend.writeFile(conflictPath, serializeProjectTasksFile(moveSource, [stayerTheirs]).content);

    // The move's destination file is ALSO already on the backend, in the
    // same sync batch — this is the evidence the resolver-path fix must
    // consult instead of trusting Dexie's not-yet-caught-up live row.
    const targetFilePath = PROJECT_TASKS.buildPath('Theta', PROJECT_THETA_ID);
    const movedAtMoveTime = buildTask({ id: TASK_T2_ID, projectId: PROJECT_THETA_ID, title: 'Moved', sortOrder: 0, updatedAt: T1 });
    await backend.writeFile(targetFilePath, serializeProjectTasksFile(moveTarget, [movedAtMoveTime]).content);

    const results = await resolveConflicts(backend);
    const resolution = results.find(r => r.conflictPath === conflictPath);
    expect(resolution).toMatchObject({ targetPath: filePath, resolved: true });

    const storedMoved = await db.projectTasks.get(TASK_T2_ID);
    expect(storedMoved).toBeTruthy();
    expect(storedMoved!.deletedAt).toBeFalsy();

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });
});
