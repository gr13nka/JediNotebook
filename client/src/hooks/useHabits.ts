import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { Habit, HabitType } from '@shared/types';
import { awardXP, XP_VALUES } from '../utils/streak';

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useHabits() {
  const weekDates = getWeekDates();
  const today = getToday();

  const habits = useLiveQuery(
    () => db.habits.filter((h) => !h.deletedAt).sortBy('sortOrder'),
    [],
  );

  const weekEntries = useLiveQuery(
    () =>
      db.habitEntries
        .filter((e) => !e.deletedAt && weekDates.includes(e.date))
        .toArray(),
    [weekDates[0]],
  );

  const [streaks, setStreaks] = useState<Record<string, number>>({});

  const computeStreak = useCallback(async (habitId: string): Promise<number> => {
    let streak = 0;
    const d = new Date();
    while (true) {
      const dateStr = d.toISOString().slice(0, 10);
      const entry = await db.habitEntries
        .where('[habitId+date]')
        .equals([habitId, dateStr])
        .and((e) => !e.deletedAt)
        .first();
      if (entry?.completed) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        // If today isn't completed yet, don't break — check yesterday
        if (dateStr === today && streak === 0) {
          d.setDate(d.getDate() - 1);
          continue;
        }
        break;
      }
    }
    return streak;
  }, [today]);

  useEffect(() => {
    if (!habits) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, number> = {};
      for (const habit of habits) {
        result[habit.id] = await computeStreak(habit.id);
      }
      if (!cancelled) setStreaks(result);
    })();
    return () => { cancelled = true; };
  }, [habits, weekEntries, computeStreak]);

  const createHabit = async (data: {
    name: string;
    type: HabitType;
    targetValue: number;
    unit: string;
    color: string;
    icon: string;
  }) => {
    const existing = await db.habits.filter((h) => !h.deletedAt).toArray();
    const now = new Date().toISOString();
    await db.habits.add({
      id: generateId(),
      name: data.name,
      type: data.type,
      color: data.color,
      icon: data.icon,
      targetValue: data.targetValue,
      unit: data.unit,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
  };

  const toggleBooleanHabit = async (habitId: string, date: string) => {
    let shouldAwardXP = false;
    await db.transaction('rw', db.habitEntries, async () => {
      const existing = await db.habitEntries
        .where('[habitId+date]')
        .equals([habitId, date])
        .and((e) => !e.deletedAt)
        .first();

      const now = new Date().toISOString();
      if (existing) {
        const newValue = existing.value === 1 ? 0 : 1;
        await db.habitEntries.update(existing.id, {
          value: newValue,
          completed: newValue === 1,
          updatedAt: now,
        });
        if (newValue === 1) shouldAwardXP = true;
      } else {
        await db.habitEntries.add({
          id: generateId(),
          habitId,
          date,
          value: 1,
          completed: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          deviceId: getDeviceId(),
        });
        shouldAwardXP = true;
      }
    });
    if (shouldAwardXP) awardXP(XP_VALUES.checkHabit);
  };

  const logNumericHabit = async (habitId: string, date: string, value: number) => {
    const habit = await db.habits.get(habitId);
    if (!habit) return;

    const existing = await db.habitEntries
      .where('[habitId+date]')
      .equals([habitId, date])
      .and((e) => !e.deletedAt)
      .first();

    const now = new Date().toISOString();
    if (existing) {
      const wasComplete = existing.value >= habit.targetValue;
      const newValue = Math.max(0, existing.value + value);
      const nowComplete = newValue >= habit.targetValue;
      await db.habitEntries.update(existing.id, {
        value: newValue,
        completed: nowComplete,
        updatedAt: now,
      });
      if (nowComplete && !wasComplete) awardXP(XP_VALUES.checkHabit);
    } else {
      const newValue = Math.max(0, value);
      const nowComplete = newValue >= habit.targetValue;
      await db.habitEntries.add({
        id: generateId(),
        habitId,
        date,
        value: newValue,
        completed: nowComplete,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deviceId: getDeviceId(),
      });
      if (nowComplete) awardXP(XP_VALUES.checkHabit);
    }
  };

  const deleteHabit = async (id: string) => {
    const now = new Date().toISOString();
    await db.habits.update(id, {
      deletedAt: now,
      updatedAt: now,
    });
  };

  return {
    habits: habits ?? [],
    weekEntries: weekEntries ?? [],
    weekDates,
    today,
    streaks,
    createHabit,
    toggleBooleanHabit,
    logNumericHabit,
    deleteHabit,
  };
}
