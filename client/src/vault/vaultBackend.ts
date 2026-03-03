export interface FileEvent {
  type: 'create' | 'modify' | 'delete';
  path: string;
}

export type WatchCallback = (events: FileEvent[]) => void;

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
