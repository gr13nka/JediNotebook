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

export const DEFAULT_CUSTOM_THEME_COLORS = {
  bgPrimary: '#1a1a2e',
  bgCard: '#16213e',
  bgElevated: '#1a3a5c',
  textPrimary: '#eaeaea',
  textSecondary: '#a0a0b0',
  textMuted: '#5a5a6e',
  accent: '#e94560',
  accentFg: '#ffffff',
  green: '#27ae60',
  red: '#e74c3c',
  barTrack: '#1a3a5c',
  border: '#1a3a5c',
};

export const DEFAULT_PROCRASTINATION_WORDS = [
  'подумать', 'вылечить', 'подготовить', 'сдать', 'провести',
  'разобраться', 'изучить', 'решить', 'обдумать', 'продумать',
  'рассмотреть', 'организовать', 'наладить', 'улучшить', 'оптимизировать',
];

export const DEFAULT_SETTINGS = {
  dayStartHour: 6,
  dayEndHour: 2,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  barStyle: 'thick-linear' as const,
  darkMode: false,
  theme: 'light' as const,
  language: 'en' as const,
  maxTasksPerProject: 5,
  navPosition: 'left' as const,
  pointsCounterVisible: true,
  accentColor: '',
  uiZoom: 110,
  pointsColorFixed: false,
  hiddenNavTabs: [] as string[],
  navTabOrder: [] as string[],
  dropdownFabCorner: 'bottom-right' as const,
  customThemeColors: DEFAULT_CUSTOM_THEME_COLORS,
  procrastinationWords: DEFAULT_PROCRASTINATION_WORDS,
  dismissedProcrastinationTaskIds: [] as string[],
  vaultEnabled: false,
  vaultPath: '',
  vaultSetupDone: false,
  recentVaults: [] as Array<{ path: string; name: string; lastOpened: string }>,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  totalXP: 0,
  todayXP: 0,
  todayXPDate: '',
  gamificationEnabled: true,
  taskTimerMinutes: 20,
  bottomNavTabs: ['/inbox', '/projects', '/tasks', '/today', '/settings'] as string[],
  bottomNavScrollable: false,
  bottomNavPages: [
    ['/', '/today', '/projects', '/habits', '/inbox'],
    ['/mindmap', '/notes', '/tasks', '/settings'],
  ] as string[][],
  mobileProjectGrid: false,
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

/**
 * Ideas (notes) is frozen: read-only in the UI and excluded from vault sync in
 * both directions.
 *
 * Reason: serializeNote() encodes the note title into the filename, so renaming
 * a note orphans its previous file, and the stale copy can later re-import over
 * the live row — notes were losing their titles and then disappearing. Freezing
 * stops the damage without deleting anything. Set to false to restore the
 * section once the filename scheme is fixed.
 */
export const IDEAS_FROZEN = true;
