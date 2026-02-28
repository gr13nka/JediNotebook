import JSZip from 'jszip';
import { MemoryBackend } from './memoryBackend';
import { exportAllToDisk, importAllFromDisk } from './vaultSync';

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

  await importAllFromDisk(backend);
}
