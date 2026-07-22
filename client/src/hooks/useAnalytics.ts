import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getLogicalDate } from '../utils/time';
import { useSettingsStore } from '../stores/settingsStore';
import type { Activity, TimeEntry } from '@shared/types';

interface DailySummary {
  activityId: string;
  activityName: string;
  color: string;
  totalSeconds: number;
  budgetMinutes: number;
}

interface WeekDay {
  date: string;
  label: string;
  activities: DailySummary[];
  totalSeconds: number;
}

interface StreakInfo {
  activityId: string;
  activityName: string;
  currentStreak: number;
  longestStreak: number;
}

export function useAnalytics() {
  const activities = useLiveQuery(
    () => db.activities.filter((a) => !a.deletedAt).toArray(),
    [],
  );
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);

  const getDailySummary = async (date: string): Promise<DailySummary[]> => {
    const acts = await db.activities.filter((a) => !a.deletedAt).toArray();
    const entries = await db.timeEntries
      .where('date')
      .equals(date)
      .filter((e) => !e.deletedAt)
      .toArray();

    return acts.map((a) => ({
      activityId: a.id,
      activityName: a.name,
      color: a.color,
      totalSeconds: entries
        .filter((e) => e.activityId === a.id)
        .reduce((sum, e) => sum + e.durationSeconds, 0),
      budgetMinutes: a.dailyBudgetMinutes,
    })).filter((s) => s.totalSeconds > 0 || s.budgetMinutes > 0);
  };

  const getWeeklySummary = async (endDate: string): Promise<WeekDay[]> => {
    const days: WeekDay[] = [];
    const end = new Date(endDate);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      // UTC throughout (both the walk and the label) — `end` came from a
      // logical-date string, i.e. UTC midnight. Reading the label via local
      // getters while the date string is UTC-derived could show a weekday
      // one day off from `dateStr` in negative-UTC-offset timezones.
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' });
      const summary = await getDailySummary(dateStr);
      days.push({
        date: dateStr,
        label: dayLabel,
        activities: summary,
        totalSeconds: summary.reduce((sum, s) => sum + s.totalSeconds, 0),
      });
    }

    return days;
  };

  const getMonthlySummary = async (endDate: string): Promise<WeekDay[]> => {
    const days: WeekDay[] = [];
    const end = new Date(endDate);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(end);
      // See getWeeklySummary above: UTC throughout for the same reason.
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const summary = await getDailySummary(dateStr);
      days.push({
        date: dateStr,
        label: dayLabel,
        activities: summary,
        totalSeconds: summary.reduce((sum, s) => sum + s.totalSeconds, 0),
      });
    }

    return days;
  };

  const getStreaks = async (): Promise<StreakInfo[]> => {
    const acts = await db.activities.filter((a) => !a.deletedAt).toArray();
    const allEntries = await db.timeEntries.filter((e) => !e.deletedAt).toArray();

    // Group entries by date
    const entriesByDate = new Map<string, TimeEntry[]>();
    allEntries.forEach((e) => {
      const existing = entriesByDate.get(e.date) ?? [];
      existing.push(e);
      entriesByDate.set(e.date, existing);
    });

    return acts.map((a) => {
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      // Check from most recent date backwards. `today` must be the LOGICAL
      // date (respecting dayStartHour), not the plain calendar date — it's
      // compared against entriesByDate keys, which come from
      // TimeEntry.date (always a logical date). Using calendar-today here
      // used to make streaks read as broken near the day boundary (e.g. a
      // 1am entry still counts toward "yesterday" logically, but a plain
      // calendar `today` would look for it under today's date and miss it).
      const today = getLogicalDate(dayStartHour);
      const d = new Date(today);
      let checking = true;

      for (let i = 0; i < 365 && checking; i++) {
        // UTC walk — `d` is anchored on `today`, a UTC-midnight-parsed
        // logical-date string; local getDate/setDate would read/write the
        // wrong calendar day for it outside UTC-ish timezones.
        const dateStr = d.toISOString().split('T')[0];
        const dayEntries = entriesByDate.get(dateStr) ?? [];
        const hasActivity = dayEntries.some(
          (e) => e.activityId === a.id && e.durationSeconds > 0,
        );

        if (hasActivity) {
          tempStreak++;
          if (i === 0 || currentStreak > 0) currentStreak = tempStreak;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 0;
          if (i > 0) checking = false;
        }

        d.setUTCDate(d.getUTCDate() - 1);
      }

      longestStreak = Math.max(longestStreak, tempStreak);

      return {
        activityId: a.id,
        activityName: a.name,
        currentStreak,
        longestStreak,
      };
    });
  };

  const getAverages = async (
    days: number = 7,
  ): Promise<{ activityId: string; activityName: string; avgSeconds: number }[]> => {
    const acts = await db.activities.filter((a) => !a.deletedAt).toArray();
    // Same logical-vs-calendar concern as getStreaks: anchor on the logical
    // "today" so the window lines up with TimeEntry.date near the boundary.
    const end = new Date(getLogicalDate(dayStartHour));
    const dateStrings: string[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i); // UTC — see getStreaks above
      dateStrings.push(d.toISOString().split('T')[0]);
    }

    const entries = await db.timeEntries
      .filter((e) => !e.deletedAt && dateStrings.includes(e.date))
      .toArray();

    return acts.map((a) => {
      const total = entries
        .filter((e) => e.activityId === a.id)
        .reduce((sum, e) => sum + e.durationSeconds, 0);
      return {
        activityId: a.id,
        activityName: a.name,
        avgSeconds: Math.round(total / days),
      };
    });
  };

  return {
    activities: activities ?? [],
    getDailySummary,
    getWeeklySummary,
    getMonthlySummary,
    getStreaks,
    getAverages,
  };
}
