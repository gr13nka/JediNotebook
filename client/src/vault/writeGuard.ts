const GUARD_TTL_MS = 2000;

/**
 * Prevents re-importing our own writes via the file watcher.
 * When we write a file, we guard that path for 2 seconds.
 * The file watcher should check isGuarded() and skip guarded paths.
 */
class WriteGuard {
  private guarded = new Map<string, number>();

  mark(path: string): void {
    this.guarded.set(path, Date.now());
  }

  isGuarded(path: string): boolean {
    const ts = this.guarded.get(path);
    if (!ts) return false;
    if (Date.now() - ts > GUARD_TTL_MS) {
      this.guarded.delete(path);
      return false;
    }
    return true;
  }

  clear(): void {
    this.guarded.clear();
  }
}

export const writeGuard = new WriteGuard();
