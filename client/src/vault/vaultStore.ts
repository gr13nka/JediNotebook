import { create } from 'zustand';
import type { VaultBackend } from './vaultBackend';
import { isTauri, isAndroidTauri } from './platform';
import { importAllFromDisk, handleExternalChange } from './vaultSync';
import { writeQueue } from './writeQueue';
import { writeGuard } from './writeGuard';
import { registerVaultMiddleware } from './dexieHooks';
import { db, clearAllTables } from '../db';
import { seedDatabase } from '../db/seed';
import { useSettingsStore } from '../stores/settingsStore';

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

  enable: (vaultPath: string) => Promise<void>;
  disable: () => void;
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

  enable: async (vaultPath: string) => {
    const state = get();
    if (state.isEnabled) state.disable();

    let backend: VaultBackend;
    if (isTauri()) {
      const { TauriVaultBackend } = await import('./tauriBackend');
      backend = new TauriVaultBackend(vaultPath);
    } else {
      // Web mode — no persistent backend, only export/import via ZIP
      return;
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

    // Initial sync: import from disk
    try {
      set({ isSyncing: true });
      await importAllFromDisk(backend);
      set({ lastSyncAt: new Date().toISOString(), isSyncing: false });
    } catch (err) {
      set({ error: String(err), isSyncing: false });
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

    // On Android, sync on app resume to pick up Syncthing changes
    if (isAndroidTauri()) {
      const handler = () => {
        if (document.visibilityState === 'visible') {
          get().syncNow();
        }
      };
      document.addEventListener('visibilitychange', handler);
      set({ _visibilityHandler: handler });
    }
  },

  disable: () => {
    const state = get();
    state._unsubMiddleware?.();
    state._unwatchFs?.();
    if (state._visibilityHandler) {
      document.removeEventListener('visibilitychange', state._visibilityHandler);
    }
    writeQueue.setBackend(null);
    writeGuard.clear();
    set({
      isEnabled: false,
      vaultPath: '',
      backend: null,
      _unsubMiddleware: null,
      _unwatchFs: null,
      _visibilityHandler: null,
    });
  },

  syncNow: async () => {
    const { backend } = get();
    if (!backend) return;

    try {
      set({ isSyncing: true, error: null });
      await writeQueue.flush();
      await importAllFromDisk(backend);
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
      const { useTaskTimerStore } = await import('../stores/taskTimerStore');
      if (useTimerStore.getState().isRunning) useTimerStore.getState().stop();
      if (usePomodoroStore.getState().isActive) usePomodoroStore.getState().stop();
      if (useTaskTimerStore.getState().isActive) useTaskTimerStore.getState().stop();
    } catch {
      // Stores may not be loaded yet — safe to ignore
    }

    // Disable current vault
    state.disable();

    // Preserve recentVaults before clearing DB
    const recentVaults = useSettingsStore.getState().recentVaults;

    // Clear all Dexie tables
    await clearAllTables();

    // Re-seed defaults
    await seedDatabase();

    // Update settings with new vault path + preserved recentVaults
    await db.settings.update('default', {
      vaultEnabled: true,
      vaultPath: newPath,
      vaultSetupDone: true,
      recentVaults: recentVaults as any,
      updatedAt: new Date().toISOString(),
    });

    // Reload settings store from DB
    await useSettingsStore.getState().load();

    // Enable new vault (imports all from disk)
    await state.enable(newPath);

    // Update recent vaults list
    const name = newPath.split('/').pop() || newPath.split('\\').pop() || 'vault';
    await useSettingsStore.getState().addRecentVault(newPath, name);
  },
}));
