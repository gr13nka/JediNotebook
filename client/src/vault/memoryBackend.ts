import type { VaultBackend } from './vaultBackend';

export class MemoryBackend implements VaultBackend {
  private files = new Map<string, string>();

  private normalizePath(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  async readFile(path: string): Promise<string> {
    const norm = this.normalizePath(path);
    const content = this.files.get(norm);
    if (content === undefined) {
      throw new Error(`File not found: ${norm}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const norm = this.normalizePath(path);
    this.files.set(norm, content);
  }

  async deleteFile(path: string): Promise<void> {
    const norm = this.normalizePath(path);
    this.files.delete(norm);
  }

  async listFiles(dir: string, extension?: string): Promise<string[]> {
    const norm = this.normalizePath(dir);
    const prefix = norm ? norm + '/' : '';
    const results: string[] = [];

    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      // Only direct children (no further slashes after prefix)
      const rest = key.slice(prefix.length);
      if (rest.includes('/')) continue;
      if (extension && !rest.endsWith(extension)) continue;
      results.push(key);
    }
    return results.sort();
  }

  async listDirs(dir: string): Promise<string[]> {
    const norm = this.normalizePath(dir);
    const prefix = norm ? norm + '/' : '';
    const dirs = new Set<string>();

    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx !== -1) {
        dirs.add(prefix + rest.slice(0, slashIdx));
      }
    }
    return [...dirs].sort();
  }

  async exists(path: string): Promise<boolean> {
    const norm = this.normalizePath(path);
    if (this.files.has(norm)) return true;
    // Check if it's a directory (any file starts with this prefix)
    const prefix = norm + '/';
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  async mkdir(_path: string): Promise<void> {
    // No-op for in-memory backend — directories are implicit
  }

  /** Get all files (for ZIP export) */
  getAll(): Map<string, string> {
    return new Map(this.files);
  }

  /** Clear all files */
  clear(): void {
    this.files.clear();
  }
}
