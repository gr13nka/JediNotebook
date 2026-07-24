import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { PREBUILT_THEMES } from './themes';

describe('prebuilt theme contrast', () => {
  it('keeps primary and secondary text readable on every surface', () => {
    for (const theme of PREBUILT_THEMES) {
      const surfaces = [theme.colors.bgPrimary, theme.colors.bgCard, theme.colors.bgElevated];
      for (const surface of surfaces) {
        expect(contrastRatio(theme.colors.textPrimary, surface), `${theme.id}: primary on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.colors.textSecondary, surface), `${theme.id}: secondary on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps text on the accent readable', () => {
    for (const theme of PREBUILT_THEMES) {
      expect(contrastRatio(theme.colors.accent, theme.colors.accentFg), `${theme.id}: accent foreground`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
