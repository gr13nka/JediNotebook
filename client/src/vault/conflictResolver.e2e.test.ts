import './testSupport';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, ProjectTask, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { resetDb } from './testSupport';
import { db } from '../db';
import { MemoryBackend } from './memoryBackend';
import { resolveConflicts, conflictTargetPath } from './conflictResolver';
import { recordBase, readBase } from './vaultBase';
import { serializeProjectFile, serializeProjectTasksFile, serializeSettings } from './serializers';
import { PROJECTS, PROJECT_TASKS } from './vaultLayout';

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
const TASK_T1_ID = '111111000000000000000000000001';
const TASK_T2_ID = '222222000000000000000000000002';
const TASK_X_ID = '333333000000000000000000000003';
const TASK_Y_ID = '444444000000000000000000000004';

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
   * Base-freshness (every merged target's recorded base matches what's on
   * disk) and import-convergence invariants are NOT checked here yet — C11
   * makes every merged target rewrite to disk (today only entity-scoped
   * kinds do, see the tasks.md scenario below), and that's what will make a
   * generic freshness check meaningful for every kind. `skipBaseFreshnessFor`
   * is reserved for that follow-up.
   */
  async function expectResolvedQuiescent(
    backend: MemoryBackend,
    _opts?: { skipBaseFreshnessFor?: string[] },
  ): Promise<void> {
    const remainingConflicts = [...backend.getAll().keys()].filter(
      path => conflictTargetPath(path) !== null,
    );
    expect(remainingConflicts).toEqual([]);

    const second = await resolveConflicts(backend);
    expect(second).toEqual([]);
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
    // a whole project's tasks rather than naming one entity), so resolveOne's
    // rewrite-to-disk step never fires for this kind today — only
    // entity-scoped kinds (projects) get that. C11 changes this. Until then,
    // deliberately no assertion on tasks.md's on-disk content here.

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
    // it hands the parsed row straight to SETTINGS_KIND.mergeRow, which is a
    // whole-row LWW swap rather than a per-field merge (current behavior;
    // C16 adds field-wise merging).
    const stored = await db.settings.get('default');
    expect(stored?.dayStartHour).toBe(9);

    expect(await backend.exists(conflictPath)).toBe(false);

    await expectResolvedQuiescent(backend);
  });
});
