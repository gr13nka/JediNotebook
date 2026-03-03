import { create } from 'zustand';

interface TaskTimerState {
  activeTaskId: string | null;
  linkedActivityId: string | null;
  remainingSeconds: number;
  totalSeconds: number;
  isActive: boolean;
  isPaused: boolean;
  countdownComplete: boolean;
  overtimeSeconds: number;
}

interface TaskTimerStore extends TaskTimerState {
  start: (config: {
    taskId: string;
    linkedActivityId: string | null;
    totalSeconds: number;
  }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  tick: () => void;
}

export const useTaskTimerStore = create<TaskTimerStore>((set, get) => ({
  activeTaskId: null,
  linkedActivityId: null,
  remainingSeconds: 0,
  totalSeconds: 0,
  isActive: false,
  isPaused: false,
  countdownComplete: false,
  overtimeSeconds: 0,

  start: (config) => {
    set({
      activeTaskId: config.taskId,
      linkedActivityId: config.linkedActivityId,
      remainingSeconds: config.totalSeconds,
      totalSeconds: config.totalSeconds,
      isActive: true,
      isPaused: false,
      countdownComplete: false,
      overtimeSeconds: 0,
    });
  },

  pause: () => {
    set({ isPaused: true });
  },

  resume: () => {
    set({ isPaused: false });
  },

  stop: () => {
    set({
      activeTaskId: null,
      linkedActivityId: null,
      remainingSeconds: 0,
      totalSeconds: 0,
      isActive: false,
      isPaused: false,
      countdownComplete: false,
      overtimeSeconds: 0,
    });
  },

  tick: () => {
    const state = get();
    if (!state.isActive || state.isPaused) return;

    if (state.remainingSeconds > 0) {
      set({ remainingSeconds: state.remainingSeconds - 1 });
      if (state.remainingSeconds - 1 === 0) {
        set({ countdownComplete: true });
      }
    } else {
      set({ overtimeSeconds: state.overtimeSeconds + 1 });
    }
  },
}));
