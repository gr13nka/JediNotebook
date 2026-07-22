import { useSyncExternalStore } from 'react';
import type { ThemeMode } from '@shared/types';
import { useSettingsStore } from '../stores/settingsStore';

function subscribe(cb: () => void): () => void {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot(): ThemeMode {
  const cl = document.documentElement.classList;
  if (cl.contains('custom')) return 'custom';
  if (cl.contains('dark')) return 'dark';
  return 'light';
}

export function useIsDark(): boolean {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot);
  return theme !== 'light';
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, getThemeSnapshot);
}

const LIGHT = {
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  accent: '#1F2937',
  bgPrimary: '#F3F4F6',
  border: '#D1D5DB',
  barTrack: '#E5E7EB',
};

const DARK = {
  textPrimary: '#F4F4F5',
  textSecondary: '#A1A1AA',
  accent: '#F4F4F5',
  bgPrimary: '#18181B',
  border: '#3F3F46',
  barTrack: '#27272A',
};

export function useThemeColors() {
  const theme = useThemeMode();
  const customColors = useSettingsStore(s => s.customThemeColors);

  if (theme === 'custom') {
    return {
      textPrimary: customColors.textPrimary,
      textSecondary: customColors.textSecondary,
      accent: customColors.accent,
      bgPrimary: customColors.bgPrimary,
      border: customColors.border,
      barTrack: customColors.barTrack,
    };
  }

  switch (theme) {
    case 'dark': return DARK;
    default: return LIGHT;
  }
}
