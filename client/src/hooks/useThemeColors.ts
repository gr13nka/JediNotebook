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
  if (cl.contains('dracula')) return 'dracula';
  if (cl.contains('gruvbox')) return 'gruvbox';
  if (cl.contains('nord')) return 'nord';
  if (cl.contains('solarized')) return 'solarized';
  if (cl.contains('catppuccin')) return 'catppuccin';
  if (cl.contains('tokyonight')) return 'tokyonight';
  if (cl.contains('neu-dark')) return 'neu-dark';
  if (cl.contains('neu-light')) return 'neu-light';
  if (cl.contains('dark')) return 'dark';
  return 'light';
}

export function useIsDark(): boolean {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot);
  return theme !== 'light' && theme !== 'neu-light';
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

const DRACULA = {
  textPrimary: '#f8f8f2',
  textSecondary: '#bfbfbf',
  accent: '#bd93f9',
  bgPrimary: '#282a36',
  border: '#44475a',
  barTrack: '#44475a',
};

const GRUVBOX = {
  textPrimary: '#ebdbb2',
  textSecondary: '#bdae93',
  accent: '#fe8019',
  bgPrimary: '#1d2021',
  border: '#3c3836',
  barTrack: '#3c3836',
};

const NORD = {
  textPrimary: '#eceff4',
  textSecondary: '#d8dee9',
  accent: '#88c0d0',
  bgPrimary: '#2e3440',
  border: '#434c5e',
  barTrack: '#434c5e',
};

const SOLARIZED = {
  textPrimary: '#fdf6e3',
  textSecondary: '#93a1a1',
  accent: '#2aa198',
  bgPrimary: '#002b36',
  border: '#0a4050',
  barTrack: '#073642',
};

const CATPPUCCIN = {
  textPrimary: '#cdd6f4',
  textSecondary: '#a6adc8',
  accent: '#cba6f7',
  bgPrimary: '#1e1e2e',
  border: '#313244',
  barTrack: '#313244',
};

const TOKYONIGHT = {
  textPrimary: '#c0caf5',
  textSecondary: '#a9b1d6',
  accent: '#7aa2f7',
  bgPrimary: '#1a1b26',
  border: '#292e42',
  barTrack: '#292e42',
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
    case 'neu-light': return NEU_LIGHT;
    case 'neu-dark': return NEU_DARK;
    case 'dark': return DARK;
    case 'dracula': return DRACULA;
    case 'gruvbox': return GRUVBOX;
    case 'nord': return NORD;
    case 'solarized': return SOLARIZED;
    case 'catppuccin': return CATPPUCCIN;
    case 'tokyonight': return TOKYONIGHT;
    default: return LIGHT;
  }
}
