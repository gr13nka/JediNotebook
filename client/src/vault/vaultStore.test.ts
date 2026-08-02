import './testSupport';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from './testSupport';
import type { VaultBackend } from './vaultBackend';

// scanToMemoryBackend (vaultStore.ts) reaches the fs plugin through a
// dynamic import — vi.mock intercepts dynamic imports too, same technique
// pollingWatcher.test.ts uses. Stubbed to an empty directory listing so
// syncNow's import stage (already covered by vaultSync/conflictResolver
// tests) is a no-op here; only the reentrancy guard and error-surfacing
// wired up by this task are under test.
const { readDirMock, readTextFileMock } = vi.hoisted(() => ({
  readDirMock: vi.fn(),
  readTextFileMock: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: readDirMock,
  readTextFile: readTextFileMock,
}));

import { useVaultStore } from './vaultStore';
import { MemoryBackend } from './memoryBackend';
import { PROJECT_TASKS } from './vaultLayout';
import { stringifyFrontmatter } from './frontmatter';

const INITIAL_STATE = useVaultStore.getState();

describe('useVaultStore.syncNow', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await resetDb();
    readDirMock.mockReset().mockResolvedValue([]);
    readTextFileMock.mockReset();
    useVaultStore.setState(INITIAL_STATE, true);
    // resolveConflicts logs a `[vault] conflicts: ...` summary whenever it
    // resolves anything — silenced here per conflictResolver.e2e.test.ts's
    // precedent, not in production code.
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns immediately without touching the backend when a sync is already running', async () => {
    const untouchable = new Proxy(
      {},
      {
        get(): never {
          throw new Error('backend touched during a reentrant syncNow');
        },
      },
    ) as VaultBackend;
    useVaultStore.setState({ isSyncing: true, backend: untouchable, vaultPath: '/vault', error: null });

    await useVaultStore.getState().syncNow();

    // The guard must fire before any backend method is even read off the
    // object (the Proxy above throws synchronously on property access), and
    // must leave the in-flight sync's own isSyncing/error alone.
    expect(useVaultStore.getState().isSyncing).toBe(true);
    expect(useVaultStore.getState().error).toBeNull();
  });

  it('sets error when a conflict copy fails to resolve, and clears it on the next clean sync', async () => {
    const backend = new MemoryBackend();
    const name = 'Zed';
    const projectId = 'a1a1a10000000000000000000000a1';
    const dir = PROJECT_TASKS.buildDirPath(name, projectId);
    const conflictPath = `${dir}/tasks.sync-conflict-20260801-120000-YZWMYOO.md`;
    // Same construction as conflictResolver.e2e.test.ts's C7 case: valid
    // frontmatter delimiters but `tasks` is not an array, so
    // deserializeProjectTasks's `.map` throws instead of parsing — a
    // permanently unparseable copy that resolveConflicts reports as
    // `resolved: false` rather than throwing itself.
    const unparseable = stringifyFrontmatter({ projectId, updatedAt: '2026-07-01T00:00:00.000Z', tasks: 42 }, '');
    await backend.writeFile(conflictPath, unparseable);

    useVaultStore.setState({ isSyncing: false, backend, vaultPath: '/vault', error: null });
    await useVaultStore.getState().syncNow();

    expect(useVaultStore.getState().isSyncing).toBe(false);
    expect(useVaultStore.getState().error).toContain('1 file');
    expect(useVaultStore.getState().error).toContain(conflictPath);

    // The failed copy is left in place by design (resolveOne only deletes it
    // on success) — simulate the underlying problem going away (the copy
    // vanishing, e.g. Syncthing superseding it) rather than re-testing
    // resolveConflicts' own retry semantics, which conflictResolver.e2e.test.ts
    // already covers.
    await backend.deleteFile(conflictPath);

    await useVaultStore.getState().syncNow();

    expect(useVaultStore.getState().error).toBeNull();
  });
});
