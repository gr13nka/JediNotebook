import { create } from 'zustand';
import type { TimerState } from '@shared/types';
import { db } from '../db';
import { newRecord, updateRecord } from '../db/repository';
import { getDeviceId } from '../utils/uuid';
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
    const entry = newRecord({
      activityId,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      isManual: false,
      date: getLogicalDate(dayStartHour),
    });
    await db.timeEntries.add(entry);

    set({
      activeEntryId: entry.id,
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
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - startedAt.getTime()) / 1000),
    );

    await updateRecord(db.timeEntries, state.activeEntryId, {
      endedAt: now.toISOString(),
      durationSeconds,
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
    // Only resume a timer this device started. A running entry synced from
    // another device is deliberately ignored: adopting it made two devices
    // share one entry, and any clock skew between them rendered as a negative
    // elapsed time.
    const deviceId = getDeviceId();
    const running = await db.timeEntries
      .filter((e) => e.endedAt === null && !e.deletedAt && e.deviceId === deviceId)
      .first();

    if (running) {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000),
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
