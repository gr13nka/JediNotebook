import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { PREBUILT_THEMES } from './themes';

describe('prebuilt theme contrast', () => {
  it('registers the wax-pencil pair with matching texture and mode metadata', () => {
    const waxLight = PREBUILT_THEMES.find((theme) => theme.id === 'wax-light');
    const waxDark = PREBUILT_THEMES.find((theme) => theme.id === 'wax-dark');

    expect(waxLight).toMatchObject({ dark: false, texture: 'wax-pencil' });
    expect(waxDark).toMatchObject({ dark: true, texture: 'wax-pencil' });
  });

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
