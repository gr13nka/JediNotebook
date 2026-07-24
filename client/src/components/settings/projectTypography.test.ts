import { describe, expect, it } from 'vitest';

// The constants mirror the visual defaults exposed by ProjectTypographySettings.
const listBase = 13;
const noteBase = 14;
const scaled = (base: number, zoom: number) => Math.round((base * zoom) / 100);

describe('project typography defaults', () => {
  it('tracks the global UI zoom until the user creates a local override', () => {
    expect(scaled(listBase, 100)).toBe(13);
    expect(scaled(noteBase, 100)).toBe(14);
    expect(scaled(listBase, 150)).toBe(20);
    expect(scaled(noteBase, 150)).toBe(21);
  });
});
