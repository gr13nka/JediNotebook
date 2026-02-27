import { create } from 'zustand';
import type { BarStyle, Language, ThemeMode } from '@shared/types';
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

function applyTheme(theme: ThemeMode) {
  const cl = document.documentElement.classList;
  cl.remove('dark', 'notion', 'neu-light', 'neu-dark');
  if (theme !== 'light') {
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
  navPosition: 'left' | 'bottom';
  timerNotificationsEnabled: boolean;
  timerNotificationIntervalMinutes: number;
  pointsCounterVisible: boolean;
  accentColor: string;
  uiZoom: number;
  pointsColorFixed: boolean;
  hiddenNavTabs: string[];
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

      set({
        dayStartHour: settings.dayStartHour,
        dayEndHour: settings.dayEndHour,
        timezone: settings.timezone,
        barStyle: settings.barStyle,
        darkMode: theme === 'dark' || theme === 'neu-dark',
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
        loaded: true,
      });
      applyTheme(theme);
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
      patch.darkMode = patch.theme === 'dark' || patch.theme === 'neu-dark';
    }
    // If darkMode is toggled directly (legacy), map to theme
    if ('darkMode' in patch && !('theme' in patch)) {
      patch.theme = patch.darkMode ? 'dark' : 'light';
    }

    set(patch);

    if ('theme' in patch && patch.theme) {
      applyTheme(patch.theme);
      // Re-apply custom accent after theme change so it overrides the new theme default
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
