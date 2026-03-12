import { useSettingsStore } from '../stores/settingsStore';
import { getLogicalDate } from './time';

export const XP_VALUES = {
  completeTask: 15,
  checkHabit: 10,
  stopTimer: 10,
  createNote: 10,
  createTask: 5,
  addInboxItem: 5,
  createMindMap: 5,
  createProject: 5,
} as const;

function getYesterday(today: string): string {
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Serialize awardXP calls to prevent read-modify-write race conditions
let xpQueue: Promise<void> = Promise.resolve();

export function awardXP(amount: number) {
  xpQueue = xpQueue.then(() => doAwardXP(amount)).catch(console.error);
}

function doAwardXP(amount: number) {
  const state = useSettingsStore.getState();
  if (!state.gamificationEnabled) return;

  const today = getLogicalDate(state.dayStartHour);
  const yesterday = getYesterday(today);

  let { currentStreak, longestStreak, lastActiveDate, totalXP, todayXP, todayXPDate } = state;

  // Reset todayXP if date changed
  if (todayXPDate !== today) {
    todayXP = 0;
    todayXPDate = today;
  }

  // Update streak
  if (lastActiveDate === today) {
    // Same day — just add XP
  } else if (lastActiveDate === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }

  totalXP += amount;
  todayXP += amount;
  lastActiveDate = today;
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  state.update({
    currentStreak,
    longestStreak,
    lastActiveDate,
    totalXP,
    todayXP,
    todayXPDate,
  });
}

export function getLevel(totalXP: number): number {
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

export function getLevelProgress(totalXP: number): { current: number; needed: number; ratio: number } {
  const level = getLevel(totalXP);
  const xpForCurrentLevel = (level - 1) * (level - 1) * 100;
  const xpForNextLevel = level * level * 100;
  const current = totalXP - xpForCurrentLevel;
  const needed = xpForNextLevel - xpForCurrentLevel;
  return { current, needed, ratio: needed > 0 ? current / needed : 0 };
}
