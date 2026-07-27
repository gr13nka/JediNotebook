import { describe, expect, it } from 'vitest';
import {
  PROJECT_LIST_BASE_PX,
  PROJECT_NOTE_BASE_PX,
  adjustProjectNoteFontPx,
  scaledProjectBase,
} from './projectTypography';

describe('project typography defaults', () => {
  it('tracks the global UI zoom until the user creates a local override', () => {
    expect(scaledProjectBase(PROJECT_LIST_BASE_PX, 100)).toBe(13);
    expect(scaledProjectBase(PROJECT_NOTE_BASE_PX, 100)).toBe(14);
    expect(scaledProjectBase(PROJECT_LIST_BASE_PX, 150)).toBe(20);
    expect(scaledProjectBase(PROJECT_NOTE_BASE_PX, 150)).toBe(21);
  });

  it('adjusts project note font size by one pixel in both directions', () => {
    expect(adjustProjectNoteFontPx(14, 1)).toBe(15);
    expect(adjustProjectNoteFontPx(14, -1)).toBe(13);
  });

  it('clamps project note font size to the settings minimum', () => {
    expect(adjustProjectNoteFontPx(10, -1)).toBe(10);
    expect(adjustProjectNoteFontPx(9.6, -1)).toBe(10);
  });

  it('rounds decimal inputs through the same integer pixel path as settings', () => {
    expect(adjustProjectNoteFontPx(14.4, 1)).toBe(15);
    expect(adjustProjectNoteFontPx(14.6, -1)).toBe(14);
  });
});
