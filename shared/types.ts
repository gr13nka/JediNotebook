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

export interface UserSettings {
  id: string;
  dayStartHour: number;
  dayEndHour: number;
  timezone: string;
  barStyle: BarStyle;
  darkMode: boolean; // legacy — prefer theme
  theme: ThemeMode;
  language: Language;
  maxTasksPerProject: number;
  navPosition: 'left' | 'bottom' | 'dropdown';
  timerNotificationsEnabled: boolean;
  timerNotificationIntervalMinutes: number;
  pointsCounterVisible: boolean;
  accentColor: string;
  procrastinationWords: string[];
  dismissedProcrastinationTaskIds: string[];
  vaultEnabled: boolean;
  vaultPath: string;
  vaultSetupDone: boolean;
  recentVaults: Array<{ path: string; name: string; lastOpened: string }>;
  updatedAt: string;
  deviceId: string;
}

export type BarStyle = 'thick-linear' | 'segmented' | 'circular';

export type ThemeMode =
  | 'light' | 'dark' | 'neu-light' | 'neu-dark'
  | 'dracula' | 'gruvbox' | 'nord' | 'solarized' | 'catppuccin' | 'tokyonight'
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

export type Language = 'en' | 'zh' | 'es' | 'pt' | 'ru';

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

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  recurrenceRule: RecurrenceRule | null;
  lastRecurredDate: string | null;
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

export type PomodoroPhase = 'work' | 'break' | 'longBreak';

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
