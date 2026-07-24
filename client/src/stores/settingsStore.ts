import { create } from 'zustand';
import type { AppFont, CustomThemeColors, Language, NavPosition, PersistedDeviceSettings, PersistedSettings, ThemeMode } from '@shared/types';
import { DEFAULT_DEVICE_SETTINGS, DEFAULT_SETTINGS } from '@shared/constants';
import { db } from '../db';
import { applyAccentColor, applyFont, applyTheme, applyZoom } from '../theme/applyTheme';
import { getPrebuiltTheme, isPrebuiltThemeId } from '../theme/themes';
import { resolveAppFont } from '../theme/fonts';

function detectBrowserLanguage(): Language {
  const browserLang = navigator.language?.slice(0, 2).toLowerCase();
  return browserLang === 'ru' ? 'ru' : 'en';
}

/** Method names on `SettingsState` — excluded from the field roster `update()`'s patch can touch. */
type SettingsAction =
  | 'loaded' | 'load' | 'update' | 'addRecentVault'
  | 'setTheme' | 'setCustomColors' | 'setAccentColor' | 'setZoom'
  | 'setFontFamily'
  | 'setTimeTrackingVisible' | 'setProjectListFontOverride' | 'setProjectNoteFontOverride'
  | 'hideTab' | 'showTab' | 'reorderTabs' | 'setNavPosition';

/**
 * Runtime store state: the persisted settings roster (`PersistedSettings`,
 * owned by shared/types.ts) plus actions and `loaded` — the one field that's
 * genuinely runtime-only (never read from or written to Dexie).
 *
 * `update()` is a pure persist-and-set primitive — no DOM side effects, no
 * input mutation. Fields whose value change must also be reflected on
 * `<html>` (theme, accent, zoom) or that have caller-facing add/remove
 * semantics (nav tabs) get an intention-revealing action instead
 * (`setTheme`, `setAccentColor`, `setZoom`, `hideTab`/`showTab`/`reorderTabs`,
 * `setNavPosition`); each of those calls `update()` internally.
 */
interface SettingsState extends PersistedSettings, PersistedDeviceSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Omit<SettingsState, SettingsAction>>) => Promise<void>;
  addRecentVault: (path: string, name: string) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setCustomColors: (colors: CustomThemeColors) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
  setFontFamily: (fontFamily: AppFont) => Promise<void>;
  setZoom: (zoom: number) => Promise<void>;
  setTimeTrackingVisible: (visible: boolean) => Promise<void>;
  setProjectListFontOverride: (px: number | null) => Promise<void>;
  setProjectNoteFontOverride: (px: number | null) => Promise<void>;
  hideTab: (tab: string) => Promise<void>;
  showTab: (tab: string) => Promise<void>;
  reorderTabs: (order: string[]) => Promise<void>;
  setNavPosition: (position: NavPosition) => Promise<void>;
}

/** Keys of the persisted settings roster, derived once from the schema's own default values. */
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof PersistedSettings)[];
const DEVICE_SETTINGS_KEYS = Object.keys(DEFAULT_DEVICE_SETTINGS) as (keyof PersistedDeviceSettings)[];

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
function pickKnownSettings<T extends object>(raw: Record<string, unknown>, keys: readonly (keyof T)[]): Partial<T> {
  const picked: Partial<T> = {};
  for (const key of keys) {
    const stringKey = key as string;
    if (raw[stringKey] != null) {
      (picked as Record<string, unknown>)[stringKey] = raw[stringKey];
    }
  }
  return picked;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  ...DEFAULT_DEVICE_SETTINGS,
  loaded: false,

  load: async () => {
    const [settings, deviceSettings] = await Promise.all([
      db.settings.get('default'),
      db.deviceSettings.get('default'),
    ]);
    const rawSettings = (settings ?? {}) as Record<string, unknown>;
    const rawDeviceSettings = (deviceSettings ?? {}) as Record<string, unknown>;
    const merged: PersistedSettings & PersistedDeviceSettings = {
      ...DEFAULT_SETTINGS,
      ...pickKnownSettings<PersistedSettings>(rawSettings, SETTINGS_KEYS),
      ...DEFAULT_DEVICE_SETTINGS,
      ...pickKnownSettings<PersistedDeviceSettings>(rawDeviceSettings, DEVICE_SETTINGS_KEYS),
    };

    // Explicit migrations only, applied on top of the merged defaults.

    // Legacy `darkMode` boolean -> `theme`, for rows saved before `theme` existed.
    if (rawDeviceSettings.theme == null && rawDeviceSettings.darkMode != null) {
      merged.theme = rawDeviceSettings.darkMode ? 'gruvbox-dark' : 'light';
    }
    if ((merged.theme as string) === 'dark') merged.theme = 'gruvbox-dark';
    if ((merged.theme as string) === 'notion' || (merged.theme as string) === 'neu-light') merged.theme = 'light';
    if (!isPrebuiltThemeId(merged.theme) && merged.theme !== 'custom') merged.theme = 'light';
    merged.fontFamily = resolveAppFont(rawDeviceSettings.fontFamily);
    merged.darkMode = merged.theme === 'custom' ? Boolean(rawDeviceSettings.darkMode) : getPrebuiltTheme(merged.theme).dark;

    if (rawDeviceSettings.language == null) merged.language = detectBrowserLanguage();
    if (merged.language !== 'en' && merged.language !== 'ru') merged.language = 'en';

    set({ ...merged, loaded: true });
    applyTheme(merged.theme, merged.customThemeColors);
    applyAccentColor(merged.accentColor);
    applyFont(merged.fontFamily);
    applyZoom(merged.uiZoom);
  },

  update: async (patch) => {
    // Copy — callers must not see their patch object mutated.
    const next = { ...patch };
    set(next);
    const sharedPatch: Record<string, unknown> = {};
    const devicePatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) {
      if ((DEVICE_SETTINGS_KEYS as string[]).includes(key)) devicePatch[key] = value;
      else if ((SETTINGS_KEYS as string[]).includes(key)) sharedPatch[key] = value;
    }
    if (Object.keys(sharedPatch).length) {
      await db.settings.update('default', { ...sharedPatch, updatedAt: new Date().toISOString() });
    }
    if (Object.keys(devicePatch).length) {
      const updated = await db.deviceSettings.update('default', devicePatch as any);
      if (!updated) await db.deviceSettings.put({ id: 'default', ...DEFAULT_DEVICE_SETTINGS, ...devicePatch } as any);
    }
  },

  addRecentVault: async (path: string, name: string) => {
    const current = get().recentVaults;
    const entry = { path, name, lastOpened: new Date().toISOString() };
    const filtered = current.filter((v) => v.path !== path);
    const updated = [entry, ...filtered].slice(0, 10);
    await get().update({ recentVaults: updated });
  },

  setTheme: async (theme) => {
    applyTheme(theme, get().customThemeColors);
    applyAccentColor(get().accentColor);
    // `darkMode` is a local legacy mirror of `theme`, never set independently.
    await get().update({
      theme,
      darkMode: theme === 'custom' ? get().darkMode : getPrebuiltTheme(theme).dark,
    });
  },

  setCustomColors: async (colors) => {
    if (get().theme === 'custom') {
      applyTheme('custom', colors);
      applyAccentColor(get().accentColor);
    }
    await get().update({ customThemeColors: colors });
  },

  setAccentColor: async (color) => {
    applyAccentColor(color);
    await get().update({ accentColor: color });
  },

  setFontFamily: async (fontFamily) => {
    const resolved = resolveAppFont(fontFamily);
    applyFont(resolved);
    await get().update({ fontFamily: resolved });
  },

  setZoom: async (zoom) => {
    const normalized = Math.max(25, Math.round(zoom));
    applyZoom(normalized);
    // A global zoom change intentionally returns project text to its default ratio.
    await get().update({
      uiZoom: normalized,
      projectListFontOverridePx: null,
      projectNoteFontOverridePx: null,
    });
  },

  setTimeTrackingVisible: async (visible) => {
    if (!visible) {
      const { useTimerStore } = await import('./timerStore');
      if (useTimerStore.getState().isRunning) await useTimerStore.getState().stop();
    }
    await get().update({ timeTrackingVisible: visible });
  },

  setProjectListFontOverride: async (px) =>
    get().update({ projectListFontOverridePx: px === null ? null : Math.max(10, Math.round(px)) }),

  setProjectNoteFontOverride: async (px) =>
    get().update({ projectNoteFontOverridePx: px === null ? null : Math.max(10, Math.round(px)) }),

  hideTab: async (tab) => {
    const current = get().hiddenNavTabs;
    if (current.includes(tab)) return;
    await get().update({ hiddenNavTabs: [...current, tab] });
  },

  showTab: async (tab) => {
    const current = get().hiddenNavTabs;
    if (!current.includes(tab)) return;
    await get().update({ hiddenNavTabs: current.filter((t) => t !== tab) });
  },

  reorderTabs: async (order) => {
    await get().update({ navTabOrder: order });
  },

  setNavPosition: async (position) => {
    await get().update({ navPosition: position });
  },
}));
