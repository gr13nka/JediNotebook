export interface Activity {
  id: string;
  name: string;
  color: string;
  dailyBudgetMinutes: number;
  isBreak: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface TimeEntry {
  id: string;
  activityId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  isManual: boolean;
  date: string; // YYYY-MM-DD logical day
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export type NavPosition = 'left' | 'bottom' | 'dropdown';

export type AppFont = 'source-serif-4' | 'ibm-plex-sans' | 'nunito-sans' | 'departure-mono';

/**
 * THE settings roster: every field the app persists to Dexie's `settings`
 * table and mirrors to the vault's `settings.json` (see `vault/serializers.ts`
 * `serializeSettings`/`deserializeSettings`). This is the single place the
 * roster is declared — `DEFAULT_SETTINGS` (`shared/constants.ts`) is checked
 * against it with `satisfies`, and `SettingsState` (`stores/settingsStore.ts`)
 * extends it, so adding/removing a field only ever happens here.
 *
 * `id`/`updatedAt`/`deviceId` are the Dexie row envelope for this singleton
 * row — see `PersistedSettings` for the roster without them. Unlike every
 * other table, the settings row has no `createdAt`/`deletedAt`: it's a
 * fixed-id singleton, not a soft-deletable envelope record (see
 * `db/seed.ts`).
 */
export interface UserSettings {
  id: string;
  dayStartHour: number;
  dayEndHour: number;
  timezone: string;
  barStyle: BarStyle;
  darkMode: boolean; // legacy — always mirrors `theme`, never independently trusted (see settingsStore.load())
  theme: ThemeMode;
  language: Language;
  maxTasksPerProject: number;
  navPosition: NavPosition;
  pointsCounterVisible: boolean;
  accentColor: string;
  /** Typeface applied across the interface and project text. */
  fontFamily: AppFont;
  uiZoom: number;
  /** Whether the time-tracking UI is available. Existing time data is preserved. */
  timeTrackingVisible: boolean;
  /** Explicit project typography overrides. `null` follows the global UI zoom. */
  projectListFontOverridePx: number | null;
  projectNoteFontOverridePx: number | null;
  pointsColorFixed: boolean;
  hiddenNavTabs: string[];
  navTabOrder: string[];
  dropdownFabCorner: string;
  customThemeColors: CustomThemeColors;
  vaultEnabled: boolean;
  vaultPath: string;
  vaultSetupDone: boolean;
  recentVaults: Array<{ path: string; name: string; lastOpened: string }>;
  bottomNavTabs: string[];
  bottomNavScrollable: boolean;
  bottomNavPages: string[][];
  mobileProjectGrid: boolean;
  /** Logical date (YYYY-MM-DD) the box-rollover last ran; `null` before the v10 migration or first rollover. Guards `useTaskRollover()` idempotency. */
  lastRolloverDate: string | null;
  updatedAt: string;
  deviceId: string;
}

/** The settings roster minus the Dexie row envelope — what `DEFAULT_SETTINGS` supplies and `SettingsState` persists. */
export type PersistedSettings = Omit<UserSettings, 'id' | 'updatedAt' | 'deviceId'>;

export type BarStyle = 'thick-linear' | 'segmented' | 'circular';

export type ThemeMode =
  | 'light'
  | 'gruvbox-dark' | 'gruvbox-light'
  | 'everforest-dark' | 'everforest-light'
  | 'catppuccin-mocha' | 'catppuccin-latte'
  | 'nord'
  | 'solarized-dark' | 'solarized-light'
  | 'dracula'
  | 'custom';

export interface CustomThemeColors {
  bgPrimary: string;
  bgCard: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentFg: string;
  green: string;
  red: string;
  barTrack: string;
  border: string;
}

export type Language = 'en' | 'ru';

export interface TimerState {
  activeEntryId: string | null;
  activeActivityId: string | null;
  startedAt: string | null;
  elapsed: number; // seconds
  isRunning: boolean;
}

export type HabitType = 'boolean' | 'numeric';

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  color: string;
  icon: string;
  targetValue: number;
  unit: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  date: string;
  value: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  parentFolderId: string | null;
  isExpanded: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  isArchived: boolean;
  folderId: string | null;
  linkedActivityId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

/** Which of the three task boxes (today/week/later) a task currently lives in. */
export type TimeBox = 'today' | 'week' | 'later';

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  recurrenceRule: RecurrenceRule | null;
  lastRecurredDate: string | null;
  /** Which box (today/week/later) the task currently lives in. */
  timeBox: TimeBox;
  /** Optional pin to a logical date (YYYY-MM-DD); not the default workflow — most tasks flow through the boxes unpinned. */
  scheduledDate: string | null;
  /** Manual order within the current box (cross-project — distinct from `sortOrder`, which is per-project). */
  timeBoxOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface TodayTask {
  id: string;
  projectTaskId: string;
  projectId: string;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface InboxItem {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface MindMapNode {
  id: string;
  text: string;
  children: string[];
  color?: string;
  collapsed?: boolean;
  direction?: 'right' | 'left' | 'top' | 'bottom';
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindMapNode[];
  rootNodeId: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface PdfDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  color: string;
  isPinned: boolean;
  thumbnail: Blob | null;
  pdfData: Blob;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface PomodoroPreset {
  id: string;
  name: string;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}
