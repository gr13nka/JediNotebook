import { useSyncExternalStore } from 'react';
import type { ThemeMode } from '@shared/types';

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
  if (cl.contains('neu-dark')) return 'neu-dark';
  if (cl.contains('neu-light')) return 'neu-light';
  if (cl.contains('dark')) return 'dark';
  return 'light';
}

export function useIsDark(): boolean {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot);
  return theme === 'dark' || theme === 'neu-dark';
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

const NEU_LIGHT = {
  textPrimary: '#2D3748',
  textSecondary: '#4A5568',
  accent: '#2D3748',
  bgPrimary: '#E0E5EC',
  border: 'transparent',
  barTrack: '#D1D9E6',
};

const NEU_DARK = {
  textPrimary: '#E0E0E0',
  textSecondary: '#A0A0A8',
  accent: '#E0E0E0',
  bgPrimary: '#2D2D32',
  border: 'transparent',
  barTrack: '#262629',
};

export function useThemeColors() {
  const theme = useThemeMode();
  if (theme === 'neu-light') return NEU_LIGHT;
  if (theme === 'neu-dark') return NEU_DARK;
  if (theme === 'dark') return DARK;
  return LIGHT;
}
