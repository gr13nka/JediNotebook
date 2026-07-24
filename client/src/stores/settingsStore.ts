import { create } from 'zustand';
import type { CustomThemeColors, Language, NavPosition, PersistedSettings, ThemeMode } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { db } from '../db';
import { applyAccentColor, applyTheme, applyZoom } from '../theme/applyTheme';
import { getPrebuiltTheme, isPrebuiltThemeId } from '../theme/themes';

function detectBrowserLanguage(): Language {
  const browserLang = navigator.language?.slice(0, 2).toLowerCase();
  return browserLang === 'ru' ? 'ru' : 'en';
}

/** Method names on `SettingsState` — excluded from the field roster `update()`'s patch can touch. */
type SettingsAction =
  | 'loaded' | 'load' | 'update' | 'addRecentVault'
  | 'setTheme' | 'setCustomColors' | 'setAccentColor' | 'setZoom'
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
interface SettingsState extends PersistedSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Omit<SettingsState, SettingsAction>>) => Promise<void>;
  addRecentVault: (path: string, name: string) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setCustomColors: (colors: CustomThemeColors) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
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
        merged.theme = raw.darkMode ? 'gruvbox-dark' : 'light';
      }
      // Legacy palette identifiers are normalised once at load time.
      if ((merged.theme as string) === 'dark') merged.theme = 'gruvbox-dark';
      if ((merged.theme as string) === 'notion' || (merged.theme as string) === 'neu-light') merged.theme = 'light';
      if (!isPrebuiltThemeId(merged.theme) && merged.theme !== 'custom') merged.theme = 'light';
      // `darkMode` always mirrors the fully-resolved theme — never trusted from the row directly.
      merged.darkMode = merged.theme === 'custom' ? Boolean(raw.darkMode) : getPrebuiltTheme(merged.theme).dark;

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
    // Copy — callers must not see their patch object mutated.
    const next = { ...patch };
    set(next);
    await db.settings.update('default', {
      ...next,
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

  setTheme: async (theme) => {
    applyTheme(theme, get().customThemeColors);
    applyAccentColor(get().accentColor);
    // `darkMode` is a legacy mirror of `theme`, kept for vault LWW compatibility — never set independently.
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
