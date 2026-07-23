import { describe, it, expect } from 'vitest';
import { nextOrderAfter } from './taskOps';

/**
 * `nextOrderAfter` is the pure arithmetic `nextBoxOrder` wraps around a
 * Dexie query — it can't be tested end-to-end without a Dexie test double
 * (this project's vitest config runs in plain `node`, no fake-indexeddb), so
 * these tests cover the part that actually matters: `max + 1` over active
 * orders, not a count, is what makes `nextBoxOrder` collision-proof.
 */
describe('nextOrderAfter', () => {
  it('returns 0 for an empty box', () => {
    expect(nextOrderAfter([])).toBe(0);
  });

  it('returns one past the max for a gap-free box', () => {
    expect(nextOrderAfter([0, 1, 2])).toBe(3);
  });

  it('returns one past the max, not the count, when a move-out has left a gap', () => {
    // Orders [0, 2] (the order-1 task moved to another box). A naive count
    // of active rows (2) would collide by appending directly onto the
    // existing order-2 task; max+1 (3) correctly lands after it.
    expect(nextOrderAfter([0, 2])).toBe(3);
  });

  it('is order-independent (unsorted input)', () => {
    expect(nextOrderAfter([2, 0, 1])).toBe(3);
  });

  it('handles a single-task box', () => {
    expect(nextOrderAfter([0])).toBe(1);
  });
});
