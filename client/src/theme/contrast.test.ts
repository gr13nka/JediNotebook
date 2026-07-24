import { describe, expect, it } from 'vitest';
import { DEFAULT_CUSTOM_THEME_COLORS } from '@shared/constants';
import { contrastRatio } from './contrast';
import { resolveAccent } from './applyTheme';
import { PREBUILT_THEMES } from './themes';

/** The `@theme` fallback in index.css — the value a theme must never resolve to. */
const CSS_FALLBACK_ACCENT = '#1F2937';

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

  it('keeps the accent readable as text on its own background', () => {
    for (const theme of PREBUILT_THEMES) {
      expect(contrastRatio(theme.colors.accent, theme.colors.bgPrimary), `${theme.id}: accent on bgPrimary`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('resolveAccent', () => {
  // Regression guard: with no override set (the default), clearing the accent
  // used to strip `--color-accent` off <html> entirely, so every theme fell
  // back to index.css's slate `#1F2937` — invisible on dark backgrounds.
  it('falls back to the theme\'s own accent, never to the CSS default', () => {
    for (const theme of PREBUILT_THEMES) {
      const resolved = resolveAccent(theme.id, DEFAULT_CUSTOM_THEME_COLORS, '');
      expect(resolved, `${theme.id}: no override`).toEqual({
        accent: theme.colors.accent,
        accentFg: theme.colors.accentFg,
      });
      expect(resolved.accent.toUpperCase(), `${theme.id}: no override`).not.toBe(CSS_FALLBACK_ACCENT);
    }
  });

  it('uses the override with a computed foreground when one is set', () => {
    expect(resolveAccent('gruvbox-dark', DEFAULT_CUSTOM_THEME_COLORS, '#f59e0b')).toEqual({
      accent: '#f59e0b',
      accentFg: '#000000',
    });
    expect(resolveAccent('light', DEFAULT_CUSTOM_THEME_COLORS, '#c62828')).toEqual({
      accent: '#c62828',
      accentFg: '#FFFFFF',
    });
  });

  it('reads the custom theme\'s accent from the passed colors', () => {
    expect(resolveAccent('custom', DEFAULT_CUSTOM_THEME_COLORS, '')).toEqual({
      accent: DEFAULT_CUSTOM_THEME_COLORS.accent,
      accentFg: DEFAULT_CUSTOM_THEME_COLORS.accentFg,
    });
  });
});
