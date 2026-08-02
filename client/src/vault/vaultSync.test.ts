import './testSupport';

import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity } from '@shared/types';
import { resetDb } from './testSupport';
import { db } from '../db';
import { exportAllToDisk, importAllFromDisk, handleExternalChange, fileIndex } from './vaultSync';
import { resolveConflicts } from './conflictResolver';
import { readBase } from './vaultBase';
import { serializeActivity } from './serializers';
import { MemoryBackend } from './memoryBackend';

beforeEach(async () => {
  await resetDb();
});

const T0 = '2026-07-01T00:00:00.000Z';
const T1 = '2026-07-15T00:00:00.000Z';
const ACTIVITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

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
