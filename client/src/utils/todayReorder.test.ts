import { describe, expect, it } from 'vitest';
import {
  TODAY_REORDER_MAX_SCROLL,
  buildTodayBoxOrder,
  computeTodayAutoScrollDelta,
  reorderIdsByActiveCenter,
} from './todayReorder';

const measurements = [
  { id: 'a', top: 0, height: 40 },
  { id: 'b', top: 50, height: 40 },
  { id: 'c', top: 100, height: 40 },
  { id: 'd', top: 150, height: 40 },
];

describe('reorderIdsByActiveCenter', () => {
  it('moves the active id before the first card whose center is below it', () => {
    expect(reorderIdsByActiveCenter(['a', 'b', 'c', 'd'], 'd', 70, measurements))
      .toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves the active id to the end when its center is below every card', () => {
    expect(reorderIdsByActiveCenter(['a', 'b', 'c', 'd'], 'a', 210, measurements))
      .toEqual(['b', 'c', 'd', 'a']);
  });

  it('keeps the same array order for a same-position drag', () => {
    const ordered = ['a', 'b', 'c', 'd'];
    expect(reorderIdsByActiveCenter(ordered, 'b', 70, measurements)).toBe(ordered);
  });

  it('ignores unknown active ids', () => {
    const ordered = ['a', 'b', 'c'];
    expect(reorderIdsByActiveCenter(ordered, 'x', 20, measurements)).toBe(ordered);
  });
});

describe('buildTodayBoxOrder', () => {
  it('appends completed task ids after reordered incomplete ids', () => {
    expect(buildTodayBoxOrder(['b', 'a'], ['done-1', 'done-2']))
      .toEqual(['b', 'a', 'done-1', 'done-2']);
  });
});

describe('computeTodayAutoScrollDelta', () => {
  it('returns zero away from the scroll edges', () => {
    expect(computeTodayAutoScrollDelta(200, 0, 400)).toBe(0);
  });

  it('scrolls upward near the top edge', () => {
    expect(computeTodayAutoScrollDelta(18, 0, 400)).toBeLessThan(0);
  });

  it('scrolls downward near the bottom edge', () => {
    expect(computeTodayAutoScrollDelta(382, 0, 400)).toBeGreaterThan(0);
  });

  it('caps scroll pressure outside the viewport', () => {
    expect(computeTodayAutoScrollDelta(-40, 0, 400)).toBe(-TODAY_REORDER_MAX_SCROLL);
    expect(computeTodayAutoScrollDelta(440, 0, 400)).toBe(TODAY_REORDER_MAX_SCROLL);
  });
});
