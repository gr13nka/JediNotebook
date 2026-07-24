import type { AppFont } from '@shared/types';

export interface FontPreset {
  id: AppFont;
  family: string;
  labelKey: 'settings.fontSourceSerif' | 'settings.fontIbmPlex' | 'settings.fontNunito' | 'settings.fontDeparture';
  descriptionKey: 'settings.fontSourceSerifDesc' | 'settings.fontIbmPlexDesc' | 'settings.fontNunitoDesc' | 'settings.fontDepartureDesc';
}

export const DEFAULT_APP_FONT: AppFont = 'source-serif-4';

export const FONT_PRESETS: readonly FontPreset[] = [
  {
    id: 'source-serif-4',
    family: "'Source Serif 4', Georgia, serif",
    labelKey: 'settings.fontSourceSerif',
    descriptionKey: 'settings.fontSourceSerifDesc',
  },
  {
    id: 'ibm-plex-sans',
    family: "'IBM Plex Sans', system-ui, sans-serif",
    labelKey: 'settings.fontIbmPlex',
    descriptionKey: 'settings.fontIbmPlexDesc',
  },
  {
    id: 'nunito-sans',
    family: "'Nunito Sans', system-ui, sans-serif",
    labelKey: 'settings.fontNunito',
    descriptionKey: 'settings.fontNunitoDesc',
  },
  {
    id: 'departure-mono',
    family: "'Departure Mono', ui-monospace, monospace",
    labelKey: 'settings.fontDeparture',
    descriptionKey: 'settings.fontDepartureDesc',
  },
] as const;

export function resolveAppFont(value: unknown): AppFont {
  return FONT_PRESETS.some((preset) => preset.id === value)
    ? value as AppFont
    : DEFAULT_APP_FONT;
}

export function getFontPreset(font: AppFont): FontPreset {
  return FONT_PRESETS.find((preset) => preset.id === font) ?? FONT_PRESETS[0];
}

/** Apply the selected global face without making each component know about font names. */
export function applyFont(font: AppFont): void {
  const resolved = resolveAppFont(font);
  const preset = getFontPreset(resolved);
  const root = document.documentElement;

  root.style.setProperty('--font-sans', preset.family);
  root.style.setProperty(
    '--font-mono',
    resolved === 'departure-mono'
      ? preset.family
      : "'SF Mono', 'Fira Code', ui-monospace, monospace",
  );
  root.dataset.font = resolved;
}
