import { create } from 'zustand';
import type { BarStyle, CustomThemeColors, Language, ThemeMode } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { db } from '../db';

const SUPPORTED_LANGUAGES: Language[] = ['en', 'zh', 'es', 'pt', 'ru'];

function detectBrowserLanguage(): Language {
  const browserLang = navigator.language?.slice(0, 2).toLowerCase();
  if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang as Language)) {
    return browserLang as Language;
  }
  return 'en';
}

const CUSTOM_COLOR_CSS_MAP: [keyof CustomThemeColors, string][] = [
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

function applyCustomTheme(colors: CustomThemeColors) {
  const el = document.documentElement;
  for (const [key, cssVar] of CUSTOM_COLOR_CSS_MAP) {
    el.style.setProperty(cssVar, colors[key]);
  }
  el.style.setProperty('--color-neu-light', 'transparent');
  el.style.setProperty('--color-neu-dark', 'transparent');
}

function clearCustomTheme() {
  const el = document.documentElement;
  for (const [, cssVar] of CUSTOM_COLOR_CSS_MAP) {
    el.style.removeProperty(cssVar);
  }
  el.style.removeProperty('--color-neu-light');
  el.style.removeProperty('--color-neu-dark');
}

function applyTheme(theme: ThemeMode, customColors?: CustomThemeColors) {
  const cl = document.documentElement.classList;
  cl.remove('dark', 'notion', 'neu-light', 'neu-dark',
    'dracula', 'gruvbox', 'nord', 'solarized', 'catppuccin', 'tokyonight', 'custom');
  clearCustomTheme();

  if (theme === 'custom' && customColors) {
    cl.add('custom');
    applyCustomTheme(customColors);
  } else if (theme !== 'light') {
    cl.add(theme);
  }
}

function applyZoom(zoom: number) {
  document.documentElement.style.fontSize = `${zoom}%`;
}

function applyAccentColor(color: string) {
  if (color) {
    document.documentElement.style.setProperty('--color-accent', color);
  } else {
    document.documentElement.style.removeProperty('--color-accent');
  }
}

interface SettingsState {
  dayStartHour: number;
  dayEndHour: number;
  timezone: string;
  barStyle: BarStyle;
  darkMode: boolean;
  theme: ThemeMode;
  language: Language;
  syncEnabled: boolean;
  syncServerUrl: string;
  syncApiKey: string;
  maxTasksPerProject: number;
  navPosition: 'left' | 'bottom' | 'dropdown';
  timerNotificationsEnabled: boolean;
  timerNotificationIntervalMinutes: number;
  pointsCounterVisible: boolean;
  accentColor: string;
  uiZoom: number;
  pointsColorFixed: boolean;
  hiddenNavTabs: string[];
  navTabOrder: string[];
  dropdownFabCorner: string;
  customThemeColors: CustomThemeColors;
  procrastinationWords: string[];
  dismissedProcrastinationTaskIds: string[];
  vaultEnabled: boolean;
  vaultPath: string;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Omit<SettingsState, 'loaded' | 'load' | 'update'>>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await db.settings.get('default');
    if (settings) {
      const raw = settings as any;
      const darkMode = raw.darkMode ?? DEFAULT_SETTINGS.darkMode;
      const maxTasksPerProject = raw.maxTasksPerProject ?? DEFAULT_SETTINGS.maxTasksPerProject;

      // Migrate: prefer theme field, fall back to darkMode boolean
      let theme: ThemeMode = raw.theme ?? (darkMode ? 'dark' : 'light');
      // Migrate legacy 'notion' theme
      if ((theme as string) === 'notion') theme = 'dark';

      const language = raw.language ?? detectBrowserLanguage();
      const customThemeColors = raw.customThemeColors ?? DEFAULT_SETTINGS.customThemeColors;

      set({
        dayStartHour: settings.dayStartHour,
        dayEndHour: settings.dayEndHour,
        timezone: settings.timezone,
        barStyle: settings.barStyle,
        darkMode: theme !== 'light' && theme !== 'neu-light',
        theme,
        language,
        syncEnabled: settings.syncEnabled,
        syncServerUrl: settings.syncServerUrl,
        syncApiKey: settings.syncApiKey,
        maxTasksPerProject,
        navPosition: raw.navPosition ?? DEFAULT_SETTINGS.navPosition,
        timerNotificationsEnabled: raw.timerNotificationsEnabled ?? DEFAULT_SETTINGS.timerNotificationsEnabled,
        timerNotificationIntervalMinutes: raw.timerNotificationIntervalMinutes ?? DEFAULT_SETTINGS.timerNotificationIntervalMinutes,
        pointsCounterVisible: raw.pointsCounterVisible ?? DEFAULT_SETTINGS.pointsCounterVisible,
        accentColor: raw.accentColor ?? DEFAULT_SETTINGS.accentColor,
        uiZoom: raw.uiZoom ?? DEFAULT_SETTINGS.uiZoom,
        pointsColorFixed: raw.pointsColorFixed ?? DEFAULT_SETTINGS.pointsColorFixed,
        hiddenNavTabs: raw.hiddenNavTabs ?? DEFAULT_SETTINGS.hiddenNavTabs,
        navTabOrder: raw.navTabOrder ?? DEFAULT_SETTINGS.navTabOrder,
        dropdownFabCorner: raw.dropdownFabCorner ?? DEFAULT_SETTINGS.dropdownFabCorner,
        customThemeColors,
        procrastinationWords: raw.procrastinationWords ?? DEFAULT_SETTINGS.procrastinationWords,
        dismissedProcrastinationTaskIds: raw.dismissedProcrastinationTaskIds ?? DEFAULT_SETTINGS.dismissedProcrastinationTaskIds,
        vaultEnabled: raw.vaultEnabled ?? DEFAULT_SETTINGS.vaultEnabled,
        vaultPath: raw.vaultPath ?? DEFAULT_SETTINGS.vaultPath,
        loaded: true,
      });
      applyTheme(theme, customThemeColors);
      applyAccentColor(raw.accentColor ?? DEFAULT_SETTINGS.accentColor);
      applyZoom(raw.uiZoom ?? DEFAULT_SETTINGS.uiZoom);
    } else {
      applyZoom(DEFAULT_SETTINGS.uiZoom);
      set({ language: detectBrowserLanguage(), loaded: true });
    }
  },

  update: async (patch) => {
    // If theme is being set, keep darkMode in sync
    if ('theme' in patch && patch.theme) {
      patch.darkMode = patch.theme !== 'light' && patch.theme !== 'neu-light';
    }
    // If darkMode is toggled directly (legacy), map to theme
    if ('darkMode' in patch && !('theme' in patch)) {
      patch.theme = patch.darkMode ? 'dark' : 'light';
    }

    set(patch);

    if ('theme' in patch && patch.theme) {
      applyTheme(patch.theme, get().customThemeColors);
      applyAccentColor(get().accentColor);
    }

    if ('customThemeColors' in patch && patch.customThemeColors && get().theme === 'custom') {
      applyCustomTheme(patch.customThemeColors);
      applyAccentColor(get().accentColor);
    }

    if ('accentColor' in patch) {
      applyAccentColor(patch.accentColor ?? '');
    }

    if ('uiZoom' in patch) {
      applyZoom(patch.uiZoom ?? DEFAULT_SETTINGS.uiZoom);
    }

    await db.settings.update('default', {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },
}));
