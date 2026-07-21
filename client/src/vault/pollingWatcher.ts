import type { WatchCallback, FileEvent } from './vaultBackend';

/** How often to re-scan the vault directory. */
export const POLL_INTERVAL_MS = 5000;

/**
 * Polling-based file watcher for Android.
 *
 * Native inotify watchers do not work reliably on external storage, so the
 * vault directory is re-scanned on a fixed interval and on app resume.
 *
 * The snapshot stores each file's mtime, which is what makes modification
 * detection possible — an earlier version stored a constant, so a file edited
 * in place by an external sync tool was never reported as changed.
 */
export class PollingWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private snapshot: Map<string, number> = new Map(); // path -> mtime (ms)
  private basePath: string;
  private callback: WatchCallback;
  private visibilityHandler: (() => void) | null = null;
  private polling = false;

  constructor(basePath: string, callback: WatchCallback) {
    this.basePath = basePath;
    this.callback = callback;
  }

  async start(intervalMs = POLL_INTERVAL_MS): Promise<void> {
    await this.buildSnapshot();

    this.intervalId = setInterval(() => this.poll(), intervalMs);

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
    // A slow scan must not overlap itself now that the interval is short.
    if (this.polling) return;
    this.polling = true;
    try {
      const currentFiles = new Map<string, number>();
      await this.scanDir('', currentFiles);

      const events: FileEvent[] = [];

      for (const [path, mtime] of currentFiles) {
        const previous = this.snapshot.get(path);
        if (previous === undefined) {
          events.push({ type: 'create', path });
        } else if (previous !== mtime) {
          events.push({ type: 'modify', path });
        }
      }

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
    } finally {
      this.polling = false;
    }
  }

  private async buildSnapshot(): Promise<void> {
    try {
      this.snapshot = new Map();
      await this.scanDir('', this.snapshot);
    } catch {
      // Directory may not exist yet
    }
  }

  private async scanDir(dir: string, files: Map<string, number>): Promise<void> {
    const { readDir, stat } = await import('@tauri-apps/plugin-fs');
    const fullPath = dir ? `${this.basePath}/${dir}` : this.basePath;
    try {
      const entries = await readDir(fullPath);
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const relativePath = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory) {
          await this.scanDir(relativePath, files);
        } else {
          let mtime = 0;
          try {
            const info = await stat(`${this.basePath}/${relativePath}`);
            mtime = info.mtime ? new Date(info.mtime).getTime() : 0;
          } catch {
            // Unreadable file — treat as unchanged rather than churning events.
            mtime = this.snapshot.get(relativePath) ?? 0;
          }
          files.set(relativePath, mtime);
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }
}
