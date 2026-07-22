import { create } from 'zustand';
import type { CustomThemeColors, Language, PersistedSettings, ThemeMode } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { db } from '../db';

function detectBrowserLanguage(): Language {
  const browserLang = navigator.language?.slice(0, 2).toLowerCase();
  return browserLang === 'ru' ? 'ru' : 'en';
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
  cl.remove('dark', 'notion', 'custom');
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

/**
 * Runtime store state: the persisted settings roster (`PersistedSettings`,
 * owned by shared/types.ts) plus actions and `loaded` — the one field that's
 * genuinely runtime-only (never read from or written to Dexie).
 */
interface SettingsState extends PersistedSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Omit<SettingsState, 'loaded' | 'load' | 'update' | 'addRecentVault'>>) => Promise<void>;
  addRecentVault: (path: string, name: string) => Promise<void>;
}

/** Keys of the persisted settings roster, derived once from the schema's own default values. */
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof PersistedSettings)[];

/**
 * Keeps only the fields the current schema still declares. A saved row can
 * carry stale keys left behind by a deleted feature (e.g. old gamification
 * fields) — picking known keys drops them from state here, so they stop
 * leaking into the app and are gone from the row after the next `update()`
 * (which only ever persists patches built from `SettingsState`).
 *
 * A key is picked only if the raw value is present (`!= null`), matching the
 * `raw.field ?? DEFAULT_SETTINGS.field` fallback this replaces: a `null` or
 * `undefined` stored value still falls through to the default below.
 */
function pickKnownSettings(raw: Record<string, unknown>): Partial<PersistedSettings> {
  const picked: Partial<PersistedSettings> = {};
  for (const key of SETTINGS_KEYS) {
    if (raw[key] != null) {
      (picked as Record<string, unknown>)[key] = raw[key];
    }
  }
  return picked;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await db.settings.get('default');
    if (settings) {
      // Loosely typed on purpose: a row saved by an older build can carry
      // fields the current schema no longer declares (e.g. deleted
      // gamification fields), which `pickKnownSettings` below is what drops.
      const raw = settings as unknown as Record<string, unknown>;

      // 1. Known fields from the saved row win over the default; everything
      //    else (missing, or a stale/removed key) falls back to DEFAULT_SETTINGS.
      const merged: PersistedSettings = { ...DEFAULT_SETTINGS, ...pickKnownSettings(raw) };

      // 2. Explicit migrations only, applied on top of the merged defaults.

      // Legacy `darkMode` boolean -> `theme`, for rows saved before `theme` existed.
      if (raw.theme == null && raw.darkMode != null) {
        merged.theme = raw.darkMode ? 'dark' : 'light';
      }
      // Legacy 'notion' theme -> 'dark'.
      if ((merged.theme as string) === 'notion') {
        merged.theme = 'dark';
      }
      // Removed prebuilt themes (palette trimmed to light/dark/custom) -> light/dark.
      if (merged.theme !== 'light' && merged.theme !== 'dark' && merged.theme !== 'custom') {
        merged.theme = (merged.theme as string) === 'neu-light' ? 'light' : 'dark';
      }
      // `darkMode` always mirrors the fully-resolved theme — never trusted from the row directly.
      merged.darkMode = merged.theme !== 'light';

      // Rows saved before `language` existed fall back to browser detection, not the static default.
      if (raw.language == null) {
        merged.language = detectBrowserLanguage();
      }
      // Removed languages (language set trimmed to en/ru) -> 'en'.
      if (merged.language !== 'en' && merged.language !== 'ru') {
        merged.language = 'en';
      }

      set({ ...merged, loaded: true });
      applyTheme(merged.theme, merged.customThemeColors);
      applyAccentColor(merged.accentColor);
      applyZoom(merged.uiZoom);
    } else {
      applyZoom(DEFAULT_SETTINGS.uiZoom);
      set({ language: detectBrowserLanguage(), loaded: true });
    }
  },

  update: async (patch) => {
    // If theme is being set, keep darkMode in sync
    if ('theme' in patch && patch.theme) {
      patch.darkMode = patch.theme !== 'light';
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

  addRecentVault: async (path: string, name: string) => {
    const current = get().recentVaults;
    const entry = { path, name, lastOpened: new Date().toISOString() };
    const filtered = current.filter((v) => v.path !== path);
    const updated = [entry, ...filtered].slice(0, 10);
    set({ recentVaults: updated });
    await db.settings.update('default', {
      recentVaults: updated as any,
      updatedAt: new Date().toISOString(),
    });
  },
}));
