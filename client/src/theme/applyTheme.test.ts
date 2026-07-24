import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CUSTOM_THEME_COLORS } from '@shared/constants';
import { applyAccentColor, applyTheme } from './applyTheme';
import { PREBUILT_THEMES } from './themes';

/**
 * `applyTheme.ts` only ever reaches for `documentElement.style`,
 * `documentElement.classList` and an optional `<meta name="theme-color">`, so
 * a hand-rolled stub covers it — and keeps these tests in the suite's node
 * environment rather than pulling in a DOM implementation.
 *
 * `props` is the assertion surface: it holds exactly the custom properties
 * currently set on `<html>`, so a *removed* property is observably different
 * from one set to a new value. That distinction is the whole point here —
 * the bug these tests guard was a `removeProperty` call letting the cascade
 * fall through to index.css's `@theme` defaults.
 */
function stubDocument() {
  const props = new Map<string, string>();
  const classes = new Set<string>();

  (globalThis as unknown as { document: unknown }).document = {
    documentElement: {
      style: {
        setProperty: (key: string, value: string) => void props.set(key, value),
        removeProperty: (key: string) => void props.delete(key),
        colorScheme: '',
      },
      classList: {
        add: (...names: string[]) => names.forEach((name) => classes.add(name)),
        remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      },
    },
    querySelector: () => null,
  };

  return { props, classes };
}

afterEach(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
});

describe('accent custom properties on <html>', () => {
  // Replays settingsStore.load()'s exact sequence. This used to leave
  // --color-accent unset for every theme, because the default accentColor is
  // '' and clearing the override removed what applyTheme had just written.
  it('keeps each theme\'s own accent after the load() sequence with no override', () => {
    for (const theme of PREBUILT_THEMES) {
      const { props } = stubDocument();

      applyTheme(theme.id, DEFAULT_CUSTOM_THEME_COLORS);
      applyAccentColor(theme.id, DEFAULT_CUSTOM_THEME_COLORS, '');

      expect(props.get('--color-accent'), `${theme.id}: accent`).toBe(theme.colors.accent);
      expect(props.get('--color-accent-fg'), `${theme.id}: accent foreground`).toBe(theme.colors.accentFg);
    }
  });

  it('applies an override on top of the theme', () => {
    const { props } = stubDocument();

    applyTheme('gruvbox-dark', DEFAULT_CUSTOM_THEME_COLORS);
    applyAccentColor('gruvbox-dark', DEFAULT_CUSTOM_THEME_COLORS, '#f59e0b');

    expect(props.get('--color-accent')).toBe('#f59e0b');
    expect(props.get('--color-accent-fg')).toBe('#000000');
  });

  // settingsStore.setAccentColor never re-applies the theme first, so
  // clearing the override has to restore the theme accent on its own.
  it('restores the theme accent when the override is cleared without a theme re-apply', () => {
    const { props } = stubDocument();

    applyTheme('gruvbox-dark', DEFAULT_CUSTOM_THEME_COLORS);
    applyAccentColor('gruvbox-dark', DEFAULT_CUSTOM_THEME_COLORS, '#f59e0b');
    applyAccentColor('gruvbox-dark', DEFAULT_CUSTOM_THEME_COLORS, '');

    expect(props.get('--color-accent')).toBe('#fe8019');
    expect(props.get('--color-accent-fg')).toBe('#282828');
  });

  it('resolves the custom theme\'s accent from its own colors', () => {
    const { props, classes } = stubDocument();

    applyTheme('custom', DEFAULT_CUSTOM_THEME_COLORS);
    applyAccentColor('custom', DEFAULT_CUSTOM_THEME_COLORS, '');

    expect(classes.has('custom')).toBe(true);
    expect(props.get('--color-accent')).toBe(DEFAULT_CUSTOM_THEME_COLORS.accent);
    expect(props.get('--color-accent-fg')).toBe(DEFAULT_CUSTOM_THEME_COLORS.accentFg);
  });
});
