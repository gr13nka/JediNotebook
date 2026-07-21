import type { VaultBackend } from './vaultBackend';
import { writeEntityToDisk } from './vaultSync';

const DEBOUNCE_MS = 300;

interface PendingWrite {
  entityType: string;
  entityId: string;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Debounced write queue. Coalesces rapid writes (e.g., reordering N tasks)
 * by keying on the compound file key (entityType:parentId).
 */
class WriteQueue {
  private pending = new Map<string, PendingWrite>();
  private backend: VaultBackend | null = null;

  setBackend(backend: VaultBackend | null): void {
    this.backend = backend;
  }

  enqueue(entityType: string, entityId: string): void {
    if (!this.backend) return;

    const key = this.getCoalesceKey(entityType, entityId);
    const existing = this.pending.get(key);

    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.pending.delete(key);
      if (this.backend) {
        writeEntityToDisk(this.backend, entityType, entityId).catch(err => {
          console.error(`[vault] Write failed for ${entityType}/${entityId}:`, err);
        });
      }
    }, DEBOUNCE_MS);

    this.pending.set(key, { entityType, entityId, timer });
  }

  /** Flush all pending writes immediately */
  async flush(): Promise<void> {
    if (!this.backend) return;
    const entries = [...this.pending.entries()];
    this.pending.clear();

    for (const [, { entityType, entityId, timer }] of entries) {
      clearTimeout(timer);
      await writeEntityToDisk(this.backend, entityType, entityId);
    }
  }

  /**
   * For compound entities (child writes re-serialize the parent file),
   * coalesce by parent key to avoid N writes for N child changes.
   */
  private getCoalesceKey(entityType: string, entityId: string): string {
    // projectTasks re-serializes the parent —
    // but we don't know the parentId here without a DB lookup.
    // So we just use entityType:entityId and let vaultSync handle the parent lookup.
    return `${entityType}:${entityId}`;
  }
}

export const writeQueue = new WriteQueue();
