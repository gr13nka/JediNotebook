import type { TimeBox } from '@shared/types';

export type SwipeReveal = 'left' | 'right' | null;

export interface SwipeResolution {
  commit: TimeBox | null;
  reveal: SwipeReveal;
  restingX: number;
}

export const SWIPE_REVEAL_X = 112;
export const SWIPE_REVEAL_THRESHOLD = 44;

export function getSwipeCommitThreshold(rowWidth: number): number {
  return Math.max(128, Math.min(190, rowWidth * 0.48));
}

export function clampSwipeOffset(offset: number, rowWidth: number): number {
  const limit = Math.max(SWIPE_REVEAL_X, getSwipeCommitThreshold(rowWidth) + 24);
  return Math.max(-limit, Math.min(limit, offset));
}

export function resolveTaskSwipe(offset: number, rowWidth: number): SwipeResolution {
  const commitThreshold = getSwipeCommitThreshold(rowWidth);
  if (offset >= commitThreshold) {
    return { commit: 'today', reveal: null, restingX: rowWidth + 32 };
  }
  if (offset <= -commitThreshold) {
    return { commit: 'later', reveal: null, restingX: -(rowWidth + 32) };
  }
  if (offset >= SWIPE_REVEAL_THRESHOLD) {
    return { commit: null, reveal: 'right', restingX: SWIPE_REVEAL_X };
  }
  if (offset <= -SWIPE_REVEAL_THRESHOLD) {
    return { commit: null, reveal: 'left', restingX: -SWIPE_REVEAL_X };
  }
  return { commit: null, reveal: null, restingX: 0 };
}
