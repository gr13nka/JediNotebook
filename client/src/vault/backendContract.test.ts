import { describe, it, expect } from 'vitest';
import { joinChildPath, type VaultBackend } from './vaultBackend';
import { MemoryBackend } from './memoryBackend';

describe('joinChildPath', () => {
  it('does not produce a leading slash at the vault root', () => {
    expect(joinChildPath('', 'settings.json')).toBe('settings.json');
  });

  it('joins a non-root dir with a slash', () => {
    expect(joinChildPath('activities', 'a.md')).toBe('activities/a.md');
  });
});

/**
 * The listing contract every VaultBackend implementation must satisfy.
 * Run this against each backend (MemoryBackend here; TauriVaultBackend in a
 * future task) so a regression in any one of them fails a named test instead
 * of silently diverging.
 */
export function describeBackendContract(name: string, mkBackend: () => VaultBackend): void {
  describe(`VaultBackend contract: ${name}`, () => {
    async function seeded(): Promise<VaultBackend> {
      const backend = mkBackend();
      await backend.writeFile('settings.json', '{}');
      await backend.writeFile('activities/a.md', '# Activity');
      return backend;
    }

    it('listFiles("") returns only direct children at the root, with no leading slash', async () => {
      const backend = await seeded();

      expect(await backend.listFiles('')).toEqual(['settings.json']);
    });

    it('listFiles(dir) returns only direct children of that dir', async () => {
      const backend = await seeded();

      expect(await backend.listFiles('activities')).toEqual(['activities/a.md']);
    });

    it('listFiles(dir, extension) filters by extension', async () => {
      const backend = mkBackend();
      await backend.writeFile('activities/a.md', '# Activity');
      await backend.writeFile('activities/a.json', '{}');

      expect(await backend.listFiles('activities', '.md')).toEqual(['activities/a.md']);
    });

    it('listDirs("") returns direct child directories, with no leading slash', async () => {
      const backend = await seeded();

      expect(await backend.listDirs('')).toEqual(['activities']);
    });

    it('exists() is true for a present path', async () => {
      const backend = await seeded();

      expect(await backend.exists('settings.json')).toBe(true);
    });

    it('exists() is false for an absent path', async () => {
      const backend = await seeded();

      expect(await backend.exists('nope.json')).toBe(false);
    });

    it('readFile() resolves the content for a present path', async () => {
      const backend = await seeded();

      expect(await backend.readFile('settings.json')).toBe('{}');
    });

    it('readFile() rejects for an absent path', async () => {
      const backend = await seeded();

      await expect(backend.readFile('nope.json')).rejects.toThrow();
    });
  });
}

describeBackendContract('MemoryBackend', () => new MemoryBackend());
