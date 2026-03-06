import type { WatchCallback, FileEvent } from './vaultBackend';

/**
 * Polling-based file watcher for Android.
 * Native inotify watchers may not work reliably on external storage,
 * so we poll the vault directory on a fixed interval and on app resume.
 */
export class PollingWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private snapshot: Map<string, number> = new Map(); // path -> mtime or 1
  private basePath: string;
  private callback: WatchCallback;
  private visibilityHandler: (() => void) | null = null;

  constructor(basePath: string, callback: WatchCallback) {
    this.basePath = basePath;
    this.callback = callback;
  }

  async start(intervalMs = 30000): Promise<void> {
    // Build initial snapshot
    await this.buildSnapshot();

    // Poll on interval
    this.intervalId = setInterval(() => this.poll(), intervalMs);

    // Poll on app resume
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.poll();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const currentFiles = new Map<string, number>();
      await this.scanDir('', currentFiles, readDir);

      const events: FileEvent[] = [];

      // Detect new/modified files
      for (const [path] of currentFiles) {
        if (!this.snapshot.has(path)) {
          events.push({ type: 'create', path });
        }
        // We can't detect modifications without stat/mtime from readDir,
        // so we only detect create/delete. External sync tools like Syncthing
        // will delete+create when modifying, which covers most cases.
      }

      // Detect deleted files
      for (const [path] of this.snapshot) {
        if (!currentFiles.has(path)) {
          events.push({ type: 'delete', path });
        }
      }

      this.snapshot = currentFiles;

      if (events.length > 0) {
        this.callback(events);
      }
    } catch (err) {
      console.error('[vault] Polling watcher error:', err);
    }
  }

  private async buildSnapshot(): Promise<void> {
    try {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      this.snapshot = new Map();
      await this.scanDir('', this.snapshot, readDir);
    } catch {
      // Directory may not exist yet
    }
  }

  private async scanDir(
    dir: string,
    files: Map<string, number>,
    readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean }>>,
  ): Promise<void> {
    const fullPath = dir ? `${this.basePath}/${dir}` : this.basePath;
    try {
      const entries = await readDir(fullPath);
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const relativePath = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory) {
          await this.scanDir(relativePath, files, readDir);
        } else {
          files.set(relativePath, 1);
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }
}
