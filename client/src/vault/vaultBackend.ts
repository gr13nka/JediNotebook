export interface FileEvent {
  type: 'create' | 'modify' | 'delete';
  path: string;
}

export type WatchCallback = (events: FileEvent[]) => void;

/**
 * The one abstraction every vault sync platform (Tauri desktop/mobile,
 * in-memory for tests/web export) implements to plug into vaultSync.ts /
 * vaultKinds.ts — those modules only ever talk to a vault through this
 * interface, never to `@tauri-apps/plugin-fs` or any other concrete API
 * directly. A new platform backend (e.g. a future browser File System
 * Access API backend) must satisfy this contract:
 *
 *  - **Paths are vault-relative, forward-slash-separated** (e.g.
 *    `'projects/My Project (019abc)/tasks.md'`), never absolute and never
 *    OS-specific separators — resolving to an absolute/native path is the
 *    backend's own job (see `TauriVaultBackend.resolve`).
 *  - **`writeFile`/`writeBinaryFile` create missing parent directories.**
 *    Callers never `mkdir` before writing.
 *  - **`readFile` rejects (throws) if `path` doesn't exist** — it does not
 *    return `null`/`undefined` for a missing file. Callers that need to
 *    tolerate a missing file must check `exists()` first or catch.
 *  - `listFiles`/`listDirs` return only direct children of `dir`, not a
 *    recursive walk.
 *  - `watch` is optional — only meaningful on platforms with a real
 *    filesystem to observe (Tauri desktop/mobile falls back to
 *    `PollingWatcher` where native watching isn't available; the in-memory
 *    backend has no watcher at all).
 */
export interface VaultBackend {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(dir: string, extension?: string): Promise<string[]>;
  listDirs(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readBinaryFile?(path: string): Promise<Uint8Array>;
  writeBinaryFile?(path: string, data: Uint8Array): Promise<void>;
  watch?(callback: WatchCallback): Promise<() => void>;
}
