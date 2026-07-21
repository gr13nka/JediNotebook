import { create } from 'zustand';
import type { VaultBackend } from './vaultBackend';
import { isTauri } from './platform';
import { importAllFromDisk, handleExternalChange } from './vaultSync';
import { writeQueue } from './writeQueue';
import { writeGuard } from './writeGuard';
import { registerVaultMiddleware } from './dexieHooks';
import { db, clearAllTables, snapshotAllTables, restoreFromSnapshot } from '../db';
import { seedDatabase } from '../db/seed';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { getDeviceId } from '../utils/uuid';
import { useSettingsStore } from '../stores/settingsStore';

/** Full reconcile interval — a safety net for anything the watcher misses. */
const RECONCILE_INTERVAL_MS = 60000;

/**
 * On Android, TauriVaultBackend's exists/readDir/readTextFile can fail
 * due to FS scope issues. Work around this by scanning the vault directory
 * recursively into a MemoryBackend (using readDir which is proven to work
 * from FolderBrowserModal), then importing from that.
 */
async function scanToMemoryBackend(vaultPath: string): Promise<VaultBackend> {
  const { MemoryBackend } = await import('./memoryBackend');
  const mem = new MemoryBackend();
  const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');

  let fileCount = 0;
  let dirCount = 0;
  let errorCount = 0;
  const firstErrors: string[] = [];

  async function scanDir(dir: string, prefix: string): Promise<void> {
    const entries = await readDir(dir);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = `${dir}/${entry.name}`;
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        dirCount++;
        await scanDir(fullPath, relativePath);
      } else {
        fileCount++;
        try {
          const content = await readTextFile(fullPath);
          await mem.writeFile(relativePath, content);
        } catch (err) {
          errorCount++;
          if (firstErrors.length < 3) {
            firstErrors.push(`${relativePath}: ${err}`);
          }
        }
      }
    }
  }

  await scanDir(vaultPath, '');
  const loaded = mem.getAll().size;
  console.log(`[vault] scan: ${loaded} loaded, ${errorCount} errors out of ${fileCount} files, ${dirCount} dirs`);
  if (firstErrors.length > 0) {
    console.warn('[vault] scan errors:', firstErrors);
  }
  if (fileCount > 0 && loaded === 0) {
    throw new Error(`Vault scan failed: found ${fileCount} files but all reads failed. ${firstErrors[0] || ''}`);
  }
  if (fileCount === 0 && dirCount > 0) {
    throw new Error(`Vault scan failed: found ${dirCount} directories but 0 files. This usually means storage permission was not granted. Please enable "All files access" in Android settings.`);
  }
  return mem;
}

interface VaultState {
  isEnabled: boolean;
  vaultPath: string;
  backend: VaultBackend | null;
  lastSyncAt: string | null;
  isSyncing: boolean;
  error: string | null;
  _unsubMiddleware: (() => void) | null;
  _unwatchFs: (() => void) | null;
  _visibilityHandler: (() => void) | null;
  _reconcileTimer: ReturnType<typeof setInterval> | null;

  enable: (vaultPath: string) => Promise<number>;
  disable: () => Promise<void>;
  syncNow: () => Promise<void>;
  switchVault: (newPath: string) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  isEnabled: false,
  vaultPath: '',
  backend: null,
  lastSyncAt: null,
  isSyncing: false,
  error: null,
  _unsubMiddleware: null,
  _unwatchFs: null,
  _visibilityHandler: null,
  _reconcileTimer: null,

  enable: async (vaultPath: string) => {
    const state = get();
    if (state.isEnabled) await state.disable();

    let backend: VaultBackend;
    if (isTauri()) {
      const { TauriVaultBackend } = await import('./tauriBackend');
      backend = new TauriVaultBackend(vaultPath);
    } else {
      // Web mode — no persistent backend, only export/import via ZIP
      return 0;
    }

    // Register Dexie middleware to intercept writes
    const unsubMiddleware = registerVaultMiddleware(db);
    writeQueue.setBackend(backend);

    set({
      isEnabled: true,
      vaultPath,
      backend,
      _unsubMiddleware: unsubMiddleware,
      error: null,
    });

    // Initial sync: scan all vault files into memory, then import.
    // Always use MemoryBackend scan (not TauriVaultBackend directly) because:
    // - Eliminates Android FS scope race conditions
    // - readDir/readTextFile work reliably across platforms
    // - Decouples file I/O from import logic for better error isolation
    let importCount = 0;
    try {
      set({ isSyncing: true });
      const readBackend = await scanToMemoryBackend(vaultPath);
      const result = await importAllFromDisk(readBackend);
      importCount = result.total;
      if (result.errors.length > 0) {
        set({ error: `Import completed with ${result.errors.length} error(s): ${result.errors.slice(0, 2).join('; ')}` });
      }
      set({ lastSyncAt: new Date().toISOString(), isSyncing: false });
    } catch (err) {
      set({ error: String(err), isSyncing: false });
      throw err;
    }

    // Start file watcher
    if (backend.watch) {
      try {
        const unwatchFs = await backend.watch((events) => {
          for (const event of events) {
            if (writeGuard.isGuarded(event.path)) continue;
            handleExternalChange(backend, event.path, event.type).catch(err => {
              console.error('[vault] External change handling failed:', err);
            });
          }
        });
        set({ _unwatchFs: unwatchFs });
      } catch (err) {
        console.error('[vault] File watcher failed to start:', err);
      }
    }

    // Sync on app resume to pick up external changes (Syncthing, laptop wake, tab switch)
    const handler = () => {
      if (document.visibilityState === 'visible') {
        get().syncNow();
      }
    };
    document.addEventListener('visibilitychange', handler);
    set({ _visibilityHandler: handler });

    // Periodic full reconcile. The watcher is the fast path; this catches
    // anything it misses — a dropped event, a platform where watching silently
    // does nothing, or a file written while the app was suspended.
    const reconcileTimer = setInterval(() => {
      const { isSyncing } = get();
      if (isSyncing) return;
      get().syncNow();
    }, RECONCILE_INTERVAL_MS);
    set({ _reconcileTimer: reconcileTimer });

    return importCount;
  },

  disable: async () => {
    const state = get();
    state._unsubMiddleware?.();
    state._unwatchFs?.();
    if (state._visibilityHandler) {
      document.removeEventListener('visibilitychange', state._visibilityHandler);
    }
    if (state._reconcileTimer) {
      clearInterval(state._reconcileTimer);
    }
    // Flush any pending vault writes before dropping the backend
    await writeQueue.flush();
    writeQueue.setBackend(null);
    writeGuard.clear();
    set({
      isEnabled: false,
      vaultPath: '',
      backend: null,
      _unsubMiddleware: null,
      _unwatchFs: null,
      _visibilityHandler: null,
      _reconcileTimer: null,
    });
  },

  syncNow: async () => {
    const { backend, vaultPath } = get();
    if (!backend) return;

    try {
      set({ isSyncing: true, error: null });
      await writeQueue.flush();
      const readBackend = await scanToMemoryBackend(vaultPath);
      const result = await importAllFromDisk(readBackend);
      if (result.errors.length > 0) {
        set({ error: `Sync completed with ${result.errors.length} error(s): ${result.errors.slice(0, 2).join('; ')}` });
      }
      set({ lastSyncAt: new Date().toISOString(), isSyncing: false });
    } catch (err) {
      set({ error: String(err), isSyncing: false });
    }
  },

  switchVault: async (newPath: string) => {
    const state = get();

    // Stop any active timers before switching
    try {
      const { useTimerStore } = await import('../stores/timerStore');
      const { usePomodoroStore } = await import('../stores/pomodoroStore');
      if (useTimerStore.getState().isRunning) useTimerStore.getState().stop();
      if (usePomodoroStore.getState().isActive) usePomodoroStore.getState().stop();
    } catch {
      // Stores may not be loaded yet — safe to ignore
    }

    // Disable current vault (flushes pending writes to disk first)
    await state.disable();

    // Preserve recentVaults before clearing DB
    const recentVaults = useSettingsStore.getState().recentVaults;

    // Snapshot all data before clearing — allows restore on failure
    const snapshot = await snapshotAllTables();

    try {
    // Clear all Dexie tables
    await clearAllTables();

    // Seed only settings (needed for LWW backdate trick)
    const existingSettings = await db.settings.get('default');
    if (!existingSettings) {
      const now = new Date().toISOString();
      await db.settings.add({
        id: 'default',
        ...DEFAULT_SETTINGS,
        updatedAt: now,
        deviceId: getDeviceId(),
      });
    }

    // Backdate seed settings so imported data always wins LWW merge
    await db.settings.update('default', {
      updatedAt: '1970-01-01T00:00:00.000Z',
    });

    // Enable new vault (imports all from disk — seed settings lose LWW, imported win)
    const imported = await state.enable(newPath);

    // Seed any remaining defaults the vault didn't provide
    await seedDatabase();

    // Export imported data back to vault — non-critical, must not block settings update
    if (imported > 0) {
      const { backend } = get();
      if (backend) {
        try {
          const { exportAllToDisk } = await import('./vaultSync');
          await exportAllToDisk(backend);
        } catch (err) {
          console.error('[vault] exportAllToDisk failed (non-fatal):', err);
        }
      }
    }

    // Update settings with vault fields (must always run, even if export failed)
    await db.settings.update('default', {
      vaultEnabled: true,
      vaultPath: newPath,
      vaultSetupDone: true,
      recentVaults: recentVaults as any,
      updatedAt: new Date().toISOString(),
    });

    // Reload settings store from DB (picks up imported settings + vault fields)
    await useSettingsStore.getState().load();

    // Update recent vaults list
    const name = newPath.split('/').pop() || newPath.split('\\').pop() || 'vault';
    await useSettingsStore.getState().addRecentVault(newPath, name);
    } catch (err) {
      // Restore original data from snapshot on any failure
      await restoreFromSnapshot(snapshot);
      await useSettingsStore.getState().load();
      throw err;
    }
  },
}));
