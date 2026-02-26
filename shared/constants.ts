export const ACTIVITY_COLORS = [
  '#E04848', // coral red
  '#2BA89E', // teal
  '#2E96B0', // ocean blue
  '#4CB85A', // green
  '#B06AB3', // plum
  '#D4A017', // amber
  '#9B59B6', // purple
  '#D4873A', // burnt orange
] as const;

export const THEME = {
  bgPrimary: '#E0E5EC',
  bgCard: '#E0E5EC',
  bgElevated: '#D1D9E6',
  textPrimary: '#2D3436',
  textSecondary: '#636E72',
  textMuted: '#99A4AA',
  accent: '#2D3436',
  green: '#27AE60',
  red: '#E74C3C',
  barTrack: '#D1D9E6',
  border: 'transparent',
  neuLight: '#FFFFFF',
  neuDark: '#A3B1C6',
  neuBg: '#E0E5EC',
} as const;

export const DEFAULT_SETTINGS = {
  dayStartHour: 6,
  dayEndHour: 2,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  barStyle: 'thick-linear' as const,
  darkMode: false,
  theme: 'light' as const,
  language: 'en' as const,
  syncEnabled: false,
  syncServerUrl: '',
  syncApiKey: '',
  maxTasksPerProject: 5,
  navPosition: 'left' as const,
  timerNotificationsEnabled: false,
  timerNotificationIntervalMinutes: 30,
  pointsCounterVisible: true,
};

export const BREAK_ACTIVITY = {
  name: 'Break',
  dailyBudgetMinutes: 60,
  isBreak: true,
};

export const OVERFILL = {
  normalMax: 1.0,
  warningMax: 1.5,
  warningColor: '#C0792E',
  dangerColor: '#C0392B',
} as const;

export const NOTE_COLORS = [
  '#E04848', '#2BA89E', '#2E96B0', '#4CB85A',
  '#B06AB3', '#D4A017', '#9B59B6', '#D4873A',
] as const;

export const API_PREFIX = '/api';
