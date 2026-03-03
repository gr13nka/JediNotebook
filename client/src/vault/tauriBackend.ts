import type { VaultBackend, WatchCallback, FileEvent } from './vaultBackend';
import type { WatchEventKind } from '@tauri-apps/plugin-fs';

/**
 * Tauri native filesystem backend.
 * Uses dynamic imports so Vite tree-shakes this from the web build.
 */
export class TauriVaultBackend implements VaultBackend {
  constructor(private basePath: string) {}

  private resolve(path: string): string {
    return `${this.basePath}/${path}`;
  }

  async readFile(path: string): Promise<string> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return readTextFile(this.resolve(path));
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
    // Ensure parent directory exists
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
    if (dir) {
      await mkdir(this.resolve(dir), { recursive: true }).catch(() => {});
    }
    await writeTextFile(this.resolve(path), content);
  }

  async deleteFile(path: string): Promise<void> {
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(this.resolve(path)).catch(() => {});
  }

  async listFiles(dir: string, extension?: string): Promise<string[]> {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    try {
      const entries = await readDir(this.resolve(dir));
      let files = entries
        .filter(e => !e.isDirectory)
        .map(e => `${dir}/${e.name}`);
      if (extension) {
        files = files.filter((f: string) => f.endsWith(extension));
      }
      return files.sort();
    } catch {
      return [];
    }
  }

  async listDirs(dir: string): Promise<string[]> {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    try {
      const entries = await readDir(this.resolve(dir));
      return entries
        .filter(e => e.isDirectory)
        .map(e => `${dir}/${e.name}`)
        .sort();
    } catch {
      return [];
    }
  }

  async exists(path: string): Promise<boolean> {
    const { exists } = await import('@tauri-apps/plugin-fs');
    return exists(this.resolve(path));
  }

  async mkdir(path: string): Promise<void> {
    const { mkdir } = await import('@tauri-apps/plugin-fs');
    await mkdir(this.resolve(path), { recursive: true }).catch(() => {});
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    return readFile(this.resolve(path));
  }

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
    if (dir) {
      await mkdir(this.resolve(dir), { recursive: true }).catch(() => {});
    }
    await writeFile(this.resolve(path), data);
  }

  async watch(callback: WatchCallback): Promise<() => void> {
    const { watch } = await import('@tauri-apps/plugin-fs');
    const unwatch = await watch(
      this.basePath,
      (event) => {
        const events: FileEvent[] = [];
        if (event.paths) {
          for (const fullPath of event.paths) {
            const relativePath = fullPath.replace(this.basePath + '/', '');
            if (relativePath.startsWith('.')) continue;
            events.push({
              type: mapEventKind(event.type),
              path: relativePath,
            });
          }
        }
        if (events.length > 0) callback(events);
      },
      { recursive: true },
    );
    return () => { unwatch(); };
  }
}

function mapEventKind(kind: WatchEventKind): FileEvent['type'] {
  if (typeof kind === 'string') {
    return 'modify';
  }
  if ('create' in kind) return 'create';
  if ('remove' in kind) return 'delete';
  return 'modify';
}
