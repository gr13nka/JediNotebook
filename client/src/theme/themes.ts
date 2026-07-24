import type { ThemeMode } from '@shared/types';
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

export type PrebuiltThemeId = Exclude<ThemeMode, 'custom'>;

export interface PrebuiltTheme {
  id: PrebuiltThemeId;
  labelKey: TranslationKey;
  dark: boolean;
  texture?: 'wax-pencil';
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
      // Quiet, paper-like default — white surfaces with Notion-style neutrals.
      bgPrimary: '#FFFFFF',
      bgCard: '#FFFFFF',
      bgElevated: '#F5F5F4',
      textPrimary: '#191919',
      textSecondary: '#4A4A4A',
      textMuted: '#747474',
      accent: '#191919',
      accentFg: '#FFFFFF',
      green: '#087443',
      red: '#C62828',
      barTrack: '#E7E7E5',
      border: '#D9D9D7',
    },
  },
  {
    id: 'wax-light',
    labelKey: 'settings.themeWaxLight',
    dark: false,
    texture: 'wax-pencil',
    colors: {
      bgPrimary: '#F5EBDD',
      bgCard: '#FFF7E8',
      bgElevated: '#EBD7C1',
      textPrimary: '#3A2921',
      textSecondary: '#6F4B39',
      textMuted: '#8C6D5B',
      accent: '#B84A27',
      accentFg: '#FFF7E8',
      green: '#3C6B45',
      red: '#A9442A',
      barTrack: '#E4CDB8',
      border: '#D8B99E',
    },
  },
  {
    id: 'wax-dark',
    labelKey: 'settings.themeWaxDark',
    dark: true,
    texture: 'wax-pencil',
    colors: {
      bgPrimary: '#2B201C',
      bgCard: '#362720',
      bgElevated: '#4A3328',
      textPrimary: '#F6E7D0',
      textSecondary: '#E2C6A7',
      textMuted: '#C7A182',
      accent: '#E26C3D',
      accentFg: '#2B201C',
      green: '#A6B36A',
      red: '#E37B63',
      barTrack: '#4B342A',
      border: '#654739',
    },
  },
  {
    id: 'gruvbox-dark',
    labelKey: 'settings.themeGruvboxDark',
    dark: true,
    colors: {
      // Gruvbox dark (medium contrast) — https://github.com/morhetz/gruvbox
      bgPrimary: '#282828',
      bgCard: '#3c3836',
      bgElevated: '#504945',
      textPrimary: '#ebdbb2',
      textSecondary: '#d5c4a1',
      textMuted: '#bdae93',
      accent: '#fe8019',
      accentFg: '#282828',
      green: '#b8bb26',
      red: '#fb4934',
      barTrack: '#3c3836',
      border: '#504945',
    },
  },
  {
    id: 'gruvbox-light', labelKey: 'settings.themeGruvboxLight', dark: false,
    colors: { bgPrimary: '#fbf1c7', bgCard: '#f9f5d7', bgElevated: '#ebdbb2', textPrimary: '#3c3836', textSecondary: '#5f564c', textMuted: '#7c6f64', accent: '#af3a03', accentFg: '#ffffff', green: '#79740e', red: '#9d0006', barTrack: '#ebdbb2', border: '#d5c4a1' },
  },
  {
    id: 'everforest-dark', labelKey: 'settings.themeEverforestDark', dark: true,
    colors: { bgPrimary: '#2d353b', bgCard: '#343f44', bgElevated: '#3d484d', textPrimary: '#d3c6aa', textSecondary: '#bdc7b5', textMuted: '#9da9a0', accent: '#a7c080', accentFg: '#2d353b', green: '#a7c080', red: '#e67e80', barTrack: '#3d484d', border: '#56635f' },
  },
  {
    id: 'everforest-light', labelKey: 'settings.themeEverforestLight', dark: false,
    colors: { bgPrimary: '#fdf6e3', bgCard: '#fffaf0', bgElevated: '#efebd4', textPrimary: '#4f5b58', textSecondary: '#5f6d69', textMuted: '#74807c', accent: '#2f7f9d', accentFg: '#ffffff', green: '#5c7a29', red: '#b23b4b', barTrack: '#e4dfc8', border: '#d6d0b8' },
  },
  {
    id: 'catppuccin-mocha', labelKey: 'settings.themeCatppuccinMocha', dark: true,
    colors: { bgPrimary: '#1e1e2e', bgCard: '#24273a', bgElevated: '#313244', textPrimary: '#cdd6f4', textSecondary: '#bac2de', textMuted: '#a6adc8', accent: '#89b4fa', accentFg: '#1e1e2e', green: '#a6e3a1', red: '#f38ba8', barTrack: '#313244', border: '#585b70' },
  },
  {
    id: 'catppuccin-latte', labelKey: 'settings.themeCatppuccinLatte', dark: false,
    colors: { bgPrimary: '#eff1f5', bgCard: '#ffffff', bgElevated: '#e6e9ef', textPrimary: '#4c4f69', textSecondary: '#5c5f77', textMuted: '#6c6f85', accent: '#1e66f5', accentFg: '#ffffff', green: '#2d8a3e', red: '#c82552', barTrack: '#dce0e8', border: '#bcc0cc' },
  },
  {
    id: 'nord', labelKey: 'settings.themeNord', dark: true,
    colors: { bgPrimary: '#2e3440', bgCard: '#3b4252', bgElevated: '#434c5e', textPrimary: '#eceff4', textSecondary: '#d8dee9', textMuted: '#c0c8d2', accent: '#88c0d0', accentFg: '#2e3440', green: '#a3be8c', red: '#bf616a', barTrack: '#434c5e', border: '#5d6a80' },
  },
  {
    id: 'solarized-dark', labelKey: 'settings.themeSolarizedDark', dark: true,
    colors: { bgPrimary: '#002b36', bgCard: '#073642', bgElevated: '#0a4552', textPrimary: '#fdf6e3', textSecondary: '#eee8d5', textMuted: '#c8c2b4', accent: '#0077b6', accentFg: '#ffffff', green: '#739b21', red: '#dc322f', barTrack: '#0a4552', border: '#42606a' },
  },
  {
    id: 'solarized-light', labelKey: 'settings.themeSolarizedLight', dark: false,
    colors: { bgPrimary: '#fdf6e3', bgCard: '#fffdf5', bgElevated: '#eee8d5', textPrimary: '#073642', textSecondary: '#35555b', textMuted: '#5d7172', accent: '#006b9b', accentFg: '#ffffff', green: '#627c19', red: '#b52b27', barTrack: '#e5ddc7', border: '#cfc5aa' },
  },
  {
    id: 'dracula', labelKey: 'settings.themeDracula', dark: true,
    colors: { bgPrimary: '#282a36', bgCard: '#303241', bgElevated: '#3c3f4f', textPrimary: '#f8f8f2', textSecondary: '#e1e1dc', textMuted: '#c1c1bb', accent: '#bd93f9', accentFg: '#282a36', green: '#50fa7b', red: '#ff5555', barTrack: '#3c3f4f', border: '#62708d' },
  },
];

const PREBUILT_THEMES_BY_ID = Object.fromEntries(
  PREBUILT_THEMES.map((theme) => [theme.id, theme]),
) as Record<PrebuiltThemeId, PrebuiltTheme>;

export function getPrebuiltTheme(id: PrebuiltThemeId): PrebuiltTheme {
  return PREBUILT_THEMES_BY_ID[id];
}

export function isPrebuiltThemeId(theme: ThemeMode): theme is PrebuiltThemeId {
  return theme !== 'custom';
}
