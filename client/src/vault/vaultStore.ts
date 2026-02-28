import { create } from 'zustand';
import type { VaultBackend } from './vaultBackend';
import { isTauri } from './platform';
import { importAllFromDisk, handleExternalChange } from './vaultSync';
import { writeQueue } from './writeQueue';
import { writeGuard } from './writeGuard';
import { registerVaultMiddleware } from './dexieHooks';
import { db } from '../db';

interface VaultState {
  isEnabled: boolean;
  vaultPath: string;
  backend: VaultBackend | null;
  lastSyncAt: string | null;
  isSyncing: boolean;
  error: string | null;
  _unsubMiddleware: (() => void) | null;
  _unwatchFs: (() => void) | null;

  enable: (vaultPath: string) => Promise<void>;
  disable: () => void;
  syncNow: () => Promise<void>;
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
  },

  disable: () => {
    const state = get();
    state._unsubMiddleware?.();
    state._unwatchFs?.();
    writeQueue.setBackend(null);
    writeGuard.clear();
    set({
      isEnabled: false,
      vaultPath: '',
      backend: null,
      _unsubMiddleware: null,
      _unwatchFs: null,
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
}));
