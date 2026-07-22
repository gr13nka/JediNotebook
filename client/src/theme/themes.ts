import type { TranslationKey } from '../i18n/translations';

/**
 * The 12 CSS custom properties every theme — prebuilt or custom — must
 * supply. Mirrors `CustomThemeColors` (shared/types.ts) field-for-field so
 * the same shape works for both.
 */
export interface ThemeColors {
  bgPrimary: string;
  bgCard: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentFg: string;
  green: string;
  red: string;
  barTrack: string;
  border: string;
}

/**
 * Maps each `ThemeColors` field to the CSS custom property it feeds. The
 * single mechanism `theme/applyTheme.ts` renders every theme through —
 * prebuilt or custom — so there is exactly one place that translates theme
 * data into `<html>` inline styles.
 */
export const THEME_COLOR_CSS_VARS: [keyof ThemeColors, string][] = [
  ['bgPrimary', '--color-bg-primary'],
  ['bgCard', '--color-bg-card'],
  ['bgElevated', '--color-bg-elevated'],
  ['textPrimary', '--color-text-primary'],
  ['textSecondary', '--color-text-secondary'],
  ['textMuted', '--color-text-muted'],
  ['accent', '--color-accent'],
  ['accentFg', '--color-accent-fg'],
  ['green', '--color-green'],
  ['red', '--color-red'],
  ['barTrack', '--color-bar-track'],
  ['border', '--color-border'],
];

export type PrebuiltThemeId = 'light' | 'dark';

export interface PrebuiltTheme {
  id: PrebuiltThemeId;
  labelKey: TranslationKey;
  dark: boolean;
  colors: ThemeColors;
}

/**
 * The one place each prebuilt theme's colors are defined — hex values
 * copied exactly from the CSS this replaces. Consumed by `theme/applyTheme.ts`
 * (DOM application), `hooks/useThemeColors.ts` (Recharts palette), and
 * `components/settings/ThemeToggle.tsx` (swatch preview), so none of them
 * hardcode a color of their own.
 */
export const PREBUILT_THEMES: PrebuiltTheme[] = [
  {
    id: 'light',
    labelKey: 'settings.themeLight',
    dark: false,
    colors: {
      bgPrimary: '#F0F1F4',
      bgCard: '#FAFBFC',
      bgElevated: '#E5E7EB',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
      textMuted: '#9CA3AF',
      accent: '#1F2937',
      accentFg: '#FFFFFF',
      green: '#27AE60',
      red: '#E74C3C',
      barTrack: '#E5E7EB',
      border: '#D1D5DB',
    },
  },
  {
    id: 'dark',
    labelKey: 'settings.themeDark',
    dark: true,
    colors: {
      bgPrimary: '#1e1e1e',
      bgCard: '#262626',
      bgElevated: '#333333',
      textPrimary: '#dcddde',
      textSecondary: '#999999',
      textMuted: '#666666',
      accent: '#7f6df2',
      accentFg: '#ffffff',
      green: '#2ECC71',
      red: '#E74C3C',
      barTrack: '#262626',
      border: '#333333',
    },
  },
];

const PREBUILT_THEMES_BY_ID: Record<PrebuiltThemeId, PrebuiltTheme> = {
  light: PREBUILT_THEMES[0],
  dark: PREBUILT_THEMES[1],
};

export function getPrebuiltTheme(id: PrebuiltThemeId): PrebuiltTheme {
  return PREBUILT_THEMES_BY_ID[id];
}
