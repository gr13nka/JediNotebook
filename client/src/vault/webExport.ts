import JSZip from 'jszip';
import { MemoryBackend } from './memoryBackend';
import { exportAllToDisk, importAllFromDisk } from './vaultSync';
import { db } from '../db';

/** Clear vault-synced tables only; device preferences must survive an import. */
async function clearDataTables(): Promise<void> {
  const tableNames = db.tables
    .map(t => t.name)
    .filter(name => name !== 'deviceSettings');
  await db.transaction('rw', db.tables, async () => {
    for (const name of tableNames) {
      await db.table(name).clear();
    }
  });
}

export async function exportToZip(): Promise<void> {
  const backend = new MemoryBackend();
  await exportAllToDisk(backend);

  const zip = new JSZip();
  for (const [path, content] of backend.getAll()) {
    zip.file(path, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vault-export-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromZip(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(file);
  const backend = new MemoryBackend();

  const entries: Promise<void>[] = [];
  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    entries.push(
      zipEntry.async('string').then(content => {
        backend.writeFile(relativePath, content);
      }),
    );
  });
  await Promise.all(entries);

  await clearDataTables();
  await importAllFromDisk(backend);
}

export async function importFromDirectory(files: FileList): Promise<void> {
  const backend = new MemoryBackend();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // webkitRelativePath gives "folderName/subdir/file.md"
    let relativePath = (file as any).webkitRelativePath || file.name;
    // Strip the top-level directory name (the selected folder)
    const slashIdx = relativePath.indexOf('/');
    if (slashIdx !== -1) {
      relativePath = relativePath.slice(slashIdx + 1);
    }
    if (!relativePath) continue;

    const content = await file.text();
    await backend.writeFile(relativePath, content);
  }

  await clearDataTables();
  await importAllFromDisk(backend);
}

/**
 * Import vault data from a filesystem path using Tauri FS.
 * Used on Android where webkitdirectory is not supported.
 */
export async function importFromPath(folderPath: string): Promise<void> {
  const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
  const backend = new MemoryBackend();

  async function scanDir(dir: string, prefix: string): Promise<void> {
    const entries = await readDir(dir);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = `${dir}/${entry.name}`;
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        await scanDir(fullPath, relativePath);
      } else {
        try {
          const content = await readTextFile(fullPath);
          await backend.writeFile(relativePath, content);
        } catch {
          // Skip binary/unreadable files
        }
      }
    }
  }

  await scanDir(folderPath, '');
  await clearDataTables();
  await importAllFromDisk(backend);
}
