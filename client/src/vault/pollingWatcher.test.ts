import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileEvent } from './vaultBackend';

// vi.mock factories are hoisted above imports, so the mock fns referenced
// inside must be created via vi.hoisted rather than plain top-level consts.
const { readDirMock, statMock } = vi.hoisted(() => ({
  readDirMock: vi.fn(),
  statMock: vi.fn(),
}));

// PollingWatcher reaches the fs plugin through a dynamic import — vi.mock
// intercepts dynamic imports too, so this stands in for the real module.
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: readDirMock,
  stat: statMock,
}));

import { PollingWatcher, POLL_INTERVAL_MS } from './pollingWatcher';

function dirEntry(name: string) {
  return { name, isDirectory: false };
}

function fileInfo(mtimeMs: number) {
  return { mtime: new Date(mtimeMs) };
}

describe('PollingWatcher', () => {
  let events: FileEvent[][];
  let onEvents: (e: FileEvent[]) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    readDirMock.mockReset();
    statMock.mockReset();
    events = [];
    onEvents = (e) => events.push(e);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports exactly one modify event when a file\'s mtime changes between polls', async () => {
    readDirMock.mockResolvedValue([dirEntry('a.md')]);
    statMock.mockResolvedValue(fileInfo(1000));

    const watcher = new PollingWatcher('/vault', onEvents);
    await watcher.start();

    statMock.mockResolvedValue(fileInfo(2000));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(events).toEqual([[{ type: 'modify', path: 'a.md' }]]);

    watcher.stop();
  });

  it('reports create for a new file and delete for one that disappeared', async () => {
    readDirMock.mockResolvedValueOnce([dirEntry('a.md')]); // consumed by the initial snapshot
    statMock.mockResolvedValue(fileInfo(1000));

    const watcher = new PollingWatcher('/vault', onEvents);
    await watcher.start();

    readDirMock.mockResolvedValueOnce([dirEntry('b.md')]); // consumed by the next poll
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(events).toEqual([[
      { type: 'create', path: 'b.md' },
      { type: 'delete', path: 'a.md' },
    ]]);

    watcher.stop();
  });

  it('warns exactly once when stat fails, and emits no spurious events', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    readDirMock.mockResolvedValue([dirEntry('a.md')]);
    statMock.mockRejectedValue(new Error('fs:allow-stat not permitted'));

    const watcher = new PollingWatcher('/vault', onEvents);
    await watcher.start(); // stat already fails during the initial snapshot

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(events).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/fs:allow-stat/);

    watcher.stop();
  });

  it('stop() stops polling', async () => {
    readDirMock.mockResolvedValue([dirEntry('a.md')]);
    statMock.mockResolvedValue(fileInfo(1000));

    const watcher = new PollingWatcher('/vault', onEvents);
    await watcher.start();

    watcher.stop();

    statMock.mockResolvedValue(fileInfo(2000)); // would be a modify event if still polling
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);

    expect(events).toEqual([]);
  });
});
