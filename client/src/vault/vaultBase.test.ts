import './testSupport';

import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './testSupport';
import { forgetBase, pruneBases, readBase, recordBase } from './vaultBase';

beforeEach(async () => {
  await resetDb();
});

describe('recordBase / readBase', () => {
  it('returns the recorded content for a path', async () => {
    await recordBase('projects/foo.md', '# Foo');

    expect(await readBase('projects/foo.md')).toBe('# Foo');
  });

  it('returns null for a path that was never recorded', async () => {
    expect(await readBase('projects/never-recorded.md')).toBeNull();
  });

  it('overwrites the previous content when re-recorded', async () => {
    await recordBase('projects/foo.md', '# Foo');
    await recordBase('projects/foo.md', '# Foo v2');

    expect(await readBase('projects/foo.md')).toBe('# Foo v2');
  });
});

describe('forgetBase', () => {
  it('removes a recorded base', async () => {
    await recordBase('projects/foo.md', '# Foo');

    await forgetBase('projects/foo.md');

    expect(await readBase('projects/foo.md')).toBeNull();
  });

  it('does not throw when forgetting an unknown path', async () => {
    await expect(forgetBase('projects/never-recorded.md')).resolves.toBeUndefined();
  });

  it('does not throw when forgetting the same path twice', async () => {
    await recordBase('projects/foo.md', '# Foo');
    await forgetBase('projects/foo.md');

    await expect(forgetBase('projects/foo.md')).resolves.toBeUndefined();
  });
});

describe('pruneBases', () => {
  it('deletes bases for paths not in the live set and keeps the rest', async () => {
    await recordBase('projects/keep.md', 'keep');
    await recordBase('projects/stale.md', 'stale');

    const deletedCount = await pruneBases(['projects/keep.md']);

    expect(deletedCount).toBe(1);
    expect(await readBase('projects/keep.md')).toBe('keep');
    expect(await readBase('projects/stale.md')).toBeNull();
  });

  it('deletes nothing when every recorded path is still live', async () => {
    await recordBase('projects/a.md', 'a');
    await recordBase('projects/b.md', 'b');

    const deletedCount = await pruneBases(['projects/a.md', 'projects/b.md']);

    expect(deletedCount).toBe(0);
    expect(await readBase('projects/a.md')).toBe('a');
    expect(await readBase('projects/b.md')).toBe('b');
  });
});
