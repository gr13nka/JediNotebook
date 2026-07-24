import type { ThemeMode } from '@shared/types';
import { useSettingsStore } from '../stores/settingsStore';
import { getPrebuiltTheme } from '../theme/themes';

export function useThemeMode(): ThemeMode {
  return useSettingsStore((s) => s.theme);
}

export function useIsDark(): boolean {
  const theme = useThemeMode();
  const customDark = useSettingsStore((s) => s.darkMode);
  return theme === 'custom' ? customDark : getPrebuiltTheme(theme).dark;
}

export function useThemeColors() {
  const theme = useThemeMode();
  const customColors = useSettingsStore((s) => s.customThemeColors);

  const { textPrimary, textSecondary, accent, bgPrimary, border, barTrack } =
    theme === 'custom' ? customColors : getPrebuiltTheme(theme).colors;

  return { textPrimary, textSecondary, accent, bgPrimary, border, barTrack };
}
