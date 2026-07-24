import type { CustomThemeColors, ThemeMode } from '@shared/types';
import { THEME_COLOR_CSS_VARS, getPrebuiltTheme, isPrebuiltThemeId, type ThemeColors } from './themes';
import { contrastingText } from './contrast';

function setColorVars(colors: ThemeColors | CustomThemeColors) {
  const el = document.documentElement;
  for (const [key, cssVar] of THEME_COLOR_CSS_VARS) {
    el.style.setProperty(cssVar, colors[key]);
  }
}

/**
 * The single place that puts a theme on the page. Sets the 12 color tokens
 * as inline custom properties on `<html>` — the mechanism every theme
 * (prebuilt or custom) renders through — and toggles the `dark`/`custom`
 * marker classes that index.css's shadow blocks still select on (shadows
 * stay class-based; colors don't need to be, since every theme's colors are
 * already known as data).
 */
export function applyTheme(theme: ThemeMode, customColors: CustomThemeColors): void {
  const cl = document.documentElement.classList;
  cl.remove('dark', 'custom');

  if (theme === 'custom') {
    cl.add('custom');
    setColorVars(customColors);
  } else if (isPrebuiltThemeId(theme)) {
    const preset = getPrebuiltTheme(theme);
    if (preset.dark) cl.add('dark');
    setColorVars(preset.colors);
  }
}

/** Accent override applied on top of whatever `applyTheme` just set — always re-applied after a theme switch. */
export function applyAccentColor(color: string): void {
  const el = document.documentElement;
  if (color) {
    el.style.setProperty('--color-accent', color);
    el.style.setProperty('--color-accent-fg', contrastingText(color));
  } else {
    el.style.removeProperty('--color-accent');
    el.style.removeProperty('--color-accent-fg');
  }
}

export function applyZoom(zoom: number): void {
  document.documentElement.style.fontSize = `${zoom}%`;
}
