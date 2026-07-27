import { describe, expect, it } from 'vitest';
import {
  SWIPE_REVEAL_X,
  clampSwipeOffset,
  getSwipeCommitThreshold,
  resolveTaskSwipe,
} from './taskSwipe';

describe('task swipe resolution', () => {
  it('snaps closed for short drags', () => {
    expect(resolveTaskSwipe(20, 360)).toEqual({ commit: null, reveal: null, restingX: 0 });
    expect(resolveTaskSwipe(-20, 360)).toEqual({ commit: null, reveal: null, restingX: 0 });
  });

  it('reveals right-side actions for medium right drags', () => {
    expect(resolveTaskSwipe(80, 360)).toEqual({ commit: null, reveal: 'right', restingX: SWIPE_REVEAL_X });
  });

  it('reveals left-side actions for medium left drags', () => {
    expect(resolveTaskSwipe(-80, 360)).toEqual({ commit: null, reveal: 'left', restingX: -SWIPE_REVEAL_X });
  });

  it('commits right drags to today', () => {
    const threshold = getSwipeCommitThreshold(360);
    expect(resolveTaskSwipe(threshold, 360).commit).toBe('today');
  });

  it('commits left drags to later', () => {
    const threshold = getSwipeCommitThreshold(360);
    expect(resolveTaskSwipe(-threshold, 360).commit).toBe('later');
  });

  it('clamps wheel offsets beyond the commit range', () => {
    expect(clampSwipeOffset(999, 360)).toBe(getSwipeCommitThreshold(360) + 24);
    expect(clampSwipeOffset(-999, 360)).toBe(-(getSwipeCommitThreshold(360) + 24));
  });
});
