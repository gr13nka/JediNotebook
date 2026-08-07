import { describe, it, expect } from 'vitest';
import { dragActivation, resolveDropSide, reorderIds } from './useDragGesture';

// The three decisions the drag channel makes that are worth pinning: when a
// press becomes a drag, which side of a row a point lands on, and where a
// dragged id ends up. Everything else in the module is pointer plumbing that
// only means anything against a real DOM.

describe('dragActivation', () => {
  it('waits while the press has not moved', () => {
    expect(dragActivation(0, 0)).toBe('wait');
  });

  it('waits just below the threshold and activates at it', () => {
    expect(dragActivation(3, 0)).toBe('wait');
    expect(dragActivation(4, 0)).toBe('activate');
    expect(dragActivation(0, -4)).toBe('activate');
  });

  it('measures distance, not per-axis movement', () => {
    // 3px right and 3px down is 4.24px of travel — a diagonal drag must not
    // need 4px on a single axis to start.
    expect(dragActivation(3, 3)).toBe('activate');
    expect(dragActivation(2, 2)).toBe('wait');
  });
});

describe('resolveDropSide', () => {
  const rect = { top: 100, height: 40 };

  it('splits the row at its midpoint', () => {
    expect(resolveDropSide(rect, 100)).toBe('above');
    expect(resolveDropSide(rect, 119)).toBe('above');
    expect(resolveDropSide(rect, 120)).toBe('below');
    expect(resolveDropSide(rect, 140)).toBe('below');
  });

  it('resolves points outside the row to the nearer side', () => {
    expect(resolveDropSide(rect, 0)).toBe('above');
    expect(resolveDropSide(rect, 500)).toBe('below');
  });
});

describe('reorderIds', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('moves an id down, onto either half of a later row', () => {
    expect(reorderIds(ids, 'a', 'c', 'below')).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderIds(ids, 'a', 'c', 'above')).toEqual(['b', 'a', 'c', 'd']);
  });

  it('moves an id up, onto either half of an earlier row', () => {
    expect(reorderIds(ids, 'd', 'b', 'above')).toEqual(['a', 'd', 'b', 'c']);
    expect(reorderIds(ids, 'd', 'b', 'below')).toEqual(['a', 'b', 'd', 'c']);
  });

  it('moves an id to either end of the list', () => {
    expect(reorderIds(ids, 'c', 'a', 'above')).toEqual(['c', 'a', 'b', 'd']);
    expect(reorderIds(ids, 'b', 'd', 'below')).toEqual(['a', 'c', 'd', 'b']);
  });

  it('returns the same array when the drop would not move anything', () => {
    // Dropping on itself, and the two landings that are where it already is.
    expect(reorderIds(ids, 'b', 'b', 'above')).toBe(ids);
    expect(reorderIds(ids, 'b', 'a', 'below')).toEqual(ids);
    expect(reorderIds(ids, 'b', 'c', 'above')).toEqual(ids);
  });

  it('returns the same array when either id is not in the list', () => {
    expect(reorderIds(ids, 'zz', 'b', 'above')).toBe(ids);
    expect(reorderIds(ids, 'a', 'zz', 'below')).toBe(ids);
  });

  it('handles a two-item list in both directions', () => {
    expect(reorderIds(['a', 'b'], 'a', 'b', 'below')).toEqual(['b', 'a']);
    expect(reorderIds(['a', 'b'], 'b', 'a', 'above')).toEqual(['b', 'a']);
  });
});
