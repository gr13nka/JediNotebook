import { create } from 'zustand';
import type { TimerState } from '@shared/types';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import { getLogicalDate } from '../utils/time';

interface TimerStore extends TimerState {
  start: (activityId: string, dayStartHour: number) => Promise<void>;
  stop: () => Promise<void>;
  tick: (elapsed: number) => void;
  restore: () => Promise<void>;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  activeEntryId: null,
  activeActivityId: null,
  startedAt: null,
  elapsed: 0,
  isRunning: false,

  start: async (activityId: string, dayStartHour: number) => {
    const state = get();
    // Stop current timer first if one is running
    if (state.isRunning) {
      await get().stop();
    }

    const now = new Date().toISOString();
    const entryId = generateId();

    await db.timeEntries.add({
      id: entryId,
      activityId,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      isManual: false,
      date: getLogicalDate(dayStartHour),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });

    set({
      activeEntryId: entryId,
      activeActivityId: activityId,
      startedAt: now,
      elapsed: 0,
      isRunning: true,
    });
  },

  stop: async () => {
    const state = get();
    if (!state.activeEntryId || !state.startedAt) return;

    const now = new Date();
    const startedAt = new Date(state.startedAt);
    const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

    await db.timeEntries.update(state.activeEntryId, {
      endedAt: now.toISOString(),
      durationSeconds,
      updatedAt: now.toISOString(),
    });

    set({
      activeEntryId: null,
      activeActivityId: null,
      startedAt: null,
      elapsed: 0,
      isRunning: false,
    });
  },

  tick: (elapsed: number) => {
    set({ elapsed });
  },

  restore: async () => {
    // Find any running entry (endedAt is null)
    const running = await db.timeEntries
      .filter((e) => e.endedAt === null && !e.deletedAt)
      .first();

    if (running) {
      const elapsed = Math.floor(
        (Date.now() - new Date(running.startedAt).getTime()) / 1000,
      );
      set({
        activeEntryId: running.id,
        activeActivityId: running.activityId,
        startedAt: running.startedAt,
        elapsed,
        isRunning: true,
      });
    }
  },
}));
