import './testSupport';

import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './testSupport';
import { exportAllToDisk } from './vaultSync';
import { resolveConflicts } from './conflictResolver';
import { MemoryBackend } from './memoryBackend';

beforeEach(async () => {
  await resetDb();
});

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
