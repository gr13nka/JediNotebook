// This is a browser-only app with no @types/node dependency, so `fs` (a real
// Node module Vitest still runs on) has no ambient type here — one narrow
// suppression beats pulling in the full @types/node package for one test.
// @ts-expect-error no @types/node in this project; Vitest provides `fs` at runtime regardless.
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

// Read the raw capability file rather than importing it, so this test exercises
// exactly the JSON Tauri parses at build time (no TS/bundler transform in the way).
// `import.meta.url` (unlike `__dirname`) needs no Node types to resolve this file's own location.
const CAPABILITY_FILE_PATH = new URL('../../src-tauri/capabilities/default.json', import.meta.url).pathname;

function readPermissions(): unknown[] {
  const raw = readFileSync(CAPABILITY_FILE_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as { permissions: unknown[] };
  return parsed.permissions;
}

/**
 * Every fs:allow-* identifier the vault layer (tauriBackend.ts + pollingWatcher.ts)
 * calls through the plugin-fs API. `fs:allow-stat` backs PollingWatcher's mtime
 * snapshot — without it every `stat()` call throws and modification detection
 * silently goes dead (see pollingWatcher.ts's doc comment and C17).
 */
const REQUIRED_FS_PERMISSIONS = [
  'fs:allow-read-text-file',
  'fs:allow-write-text-file',
  'fs:allow-mkdir',
  'fs:allow-remove',
  'fs:allow-exists',
  'fs:allow-read-dir',
  'fs:allow-watch',
  'fs:allow-read-file',
  'fs:allow-write-file',
  'fs:allow-stat',
];

describe('src-tauri/capabilities/default.json', () => {
  it('grants every fs permission the vault layer needs', () => {
    const permissions = readPermissions();

    for (const required of REQUIRED_FS_PERMISSIONS) {
      expect(permissions).toContain(required);
    }
  });
});
