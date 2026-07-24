import type { CustomThemeColors, ThemeMode } from '@shared/types';
import { THEME_COLOR_CSS_VARS, getPrebuiltTheme, isPrebuiltThemeId, type ThemeColors } from './themes';
import { contrastingText } from './contrast';
export { applyFont } from './fonts';

function setColorVars(colors: ThemeColors | CustomThemeColors) {
  const el = document.documentElement;
  for (const [key, cssVar] of THEME_COLOR_CSS_VARS) {
    el.style.setProperty(cssVar, colors[key]);
  }
}

/**
 * The single place that puts a theme on the page. Sets the 12 color tokens
 * as inline custom properties on `<html>` — the mechanism every theme
 * (prebuilt or custom) renders through — and toggles the marker classes that
 * index.css uses for dark shadows and the wax-pencil surface treatment.
 */
function setBrowserThemeColor(color: string): void {
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', color);
}

export function applyTheme(theme: ThemeMode, customColors: CustomThemeColors): void {
  const cl = document.documentElement.classList;
  const root = document.documentElement;
  cl.remove('dark', 'custom', 'wax-pencil');

  if (theme === 'custom') {
    cl.add('custom');
    setColorVars(customColors);
    root.style.colorScheme = contrastingText(customColors.bgPrimary) === '#FFFFFF' ? 'dark' : 'light';
    setBrowserThemeColor(customColors.bgPrimary);
  } else if (isPrebuiltThemeId(theme)) {
    const preset = getPrebuiltTheme(theme);
    if (preset.dark) cl.add('dark');
    if (preset.texture === 'wax-pencil') cl.add('wax-pencil');
    setColorVars(preset.colors);
    root.style.colorScheme = preset.dark ? 'dark' : 'light';
    setBrowserThemeColor(preset.colors.bgPrimary);
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
