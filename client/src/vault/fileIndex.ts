/**
 * Bidirectional index: entityId <-> filePath
 * Used to resolve renames (old path) and to quickly find files by entity ID.
 */
export class FileIndex {
  private idToPath = new Map<string, string>();
  private pathToId = new Map<string, string>();

  set(entityId: string, filePath: string): void {
    // Remove old mappings if they exist
    const oldPath = this.idToPath.get(entityId);
    if (oldPath) this.pathToId.delete(oldPath);
    const oldId = this.pathToId.get(filePath);
    if (oldId) this.idToPath.delete(oldId);

    this.idToPath.set(entityId, filePath);
    this.pathToId.set(filePath, entityId);
  }

  getPath(entityId: string): string | undefined {
    return this.idToPath.get(entityId);
  }

  getId(filePath: string): string | undefined {
    return this.pathToId.get(filePath);
  }

  removePath(filePath: string): void {
    const id = this.pathToId.get(filePath);
    if (id) this.idToPath.delete(id);
    this.pathToId.delete(filePath);
  }

  removeId(entityId: string): void {
    const path = this.idToPath.get(entityId);
    if (path) this.pathToId.delete(path);
    this.idToPath.delete(entityId);
  }

  clear(): void {
    this.idToPath.clear();
    this.pathToId.clear();
  }

  get size(): number {
    return this.idToPath.size;
  }
}

/**
 * The vault's single fileIndex instance. Lives here (rather than in
 * vaultSync.ts, its main consumer) so vaultKinds.ts can also read it —
 * `gatherWriteSet` needs a kind's previous path to detect renames — without
 * creating a circular import between the two.
 */
export const fileIndex = new FileIndex();
