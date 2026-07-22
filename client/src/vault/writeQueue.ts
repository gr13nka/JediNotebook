import type { VaultBackend } from './vaultBackend';
import { writeEntityToDisk } from './vaultSync';

const DEBOUNCE_MS = 300;

interface PendingWrite {
  entityType: string;
  entityId: string;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Debounced write queue. Coalesces rapid repeated writes to the *same*
 * entity (e.g. dragging one task, which fires several sortOrder updates in
 * quick succession) by keying pending writes on `entityType:entityId` — see
 * `getCoalesceKey`'s doc comment for why this does not coalesce across
 * *different* entities that happen to serialize to the same file.
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
   * Keys pending writes by `entityType:entityId`, not by the file the write
   * will actually touch. For most kinds those are the same thing. For
   * projectTasks they aren't: `gatherWriteSet` re-serializes the *parent*
   * project's files (see `PROJECT_TASKS_KIND.gatherWriteSet` in
   * vaultKinds.ts), so reordering N sibling tasks enqueues N different
   * entityIds and produces N separate debounced writes of the same
   * project.md/tasks.md, instead of coalescing into one.
   *
   * That's wasted I/O, not a correctness bug — each write re-serializes the
   * full current state, so the redundant writes are idempotent and the
   * last one always leaves the right content on disk. True coalescing
   * would need this method to resolve entityId -> parentId, which requires
   * an async Dexie lookup; `enqueue` below is synchronous by design (called
   * straight from Dexie hooks on every write), and racing that lookup
   * against another sibling's concurrent `enqueue` call is easy to get
   * subtly wrong. Not worth it for an I/O-only cost — left as future work
   * if the redundant writes ever become a real problem.
   */
  private getCoalesceKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }
}

export const writeQueue = new WriteQueue();
