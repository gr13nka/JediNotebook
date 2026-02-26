import { create } from 'zustand';
import type { PomodoroPhase } from '@shared/types';

interface PomodoroState {
  isActive: boolean;
  isPaused: boolean;
  phase: PomodoroPhase;
  remainingSeconds: number;
  currentSession: number;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  linkedActivityId: string | null;
  selectedPresetId: string | null;
  totalSeconds: number;
}

interface PomodoroConfig {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  presetId: string;
  linkedActivityId?: string | null;
}

interface PomodoroActions {
  startSession: (config: PomodoroConfig) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
  tick: () => void;
  setLinkedActivity: (id: string | null) => void;
  setSelectedPreset: (id: string | null) => void;
}

export type PomodoroStore = PomodoroState & PomodoroActions;

export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  isActive: false,
  isPaused: false,
  phase: 'work',
  remainingSeconds: 0,
  currentSession: 1,
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartWork: false,
  linkedActivityId: null,
  selectedPresetId: null,
  totalSeconds: 0,

  startSession: (config) => {
    const totalSeconds = config.workMinutes * 60;
    set({
      isActive: true,
      isPaused: false,
      phase: 'work',
      remainingSeconds: totalSeconds,
      totalSeconds,
      currentSession: 1,
      workMinutes: config.workMinutes,
      breakMinutes: config.breakMinutes,
      longBreakMinutes: config.longBreakMinutes,
      sessionsBeforeLongBreak: config.sessionsBeforeLongBreak,
      autoStartBreaks: config.autoStartBreaks,
      autoStartWork: config.autoStartWork,
      selectedPresetId: config.presetId,
      linkedActivityId: config.linkedActivityId ?? null,
    });
  },

  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),

  stop: () =>
    set({
      isActive: false,
      isPaused: false,
      phase: 'work',
      remainingSeconds: 0,
      totalSeconds: 0,
      currentSession: 1,
    }),

  setLinkedActivity: (id) => set({ linkedActivityId: id }),
  setSelectedPreset: (id) => set({ selectedPresetId: id }),

  skip: () => {
    const state = get();
    if (!state.isActive) return;
    advancePhase(state, set);
  },

  tick: () => {
    const state = get();
    if (!state.isActive || state.isPaused) return;

    const next = state.remainingSeconds - 1;
    if (next <= 0) {
      advancePhase(state, set);
    } else {
      set({ remainingSeconds: next });
    }
  },
}));

function advancePhase(
  state: PomodoroState,
  set: (patch: Partial<PomodoroState>) => void,
) {
  const { phase, currentSession, sessionsBeforeLongBreak } = state;

  if (phase === 'work') {
    const isLongBreak = currentSession >= sessionsBeforeLongBreak;
    const nextPhase: PomodoroPhase = isLongBreak ? 'longBreak' : 'break';
    const minutes = isLongBreak ? state.longBreakMinutes : state.breakMinutes;
    const totalSeconds = minutes * 60;
    set({
      phase: nextPhase,
      remainingSeconds: totalSeconds,
      totalSeconds,
      isPaused: !state.autoStartBreaks,
    });
  } else {
    // break or longBreak ended → next work session
    const nextSession = phase === 'longBreak' ? 1 : currentSession + 1;
    const totalSeconds = state.workMinutes * 60;
    set({
      phase: 'work',
      remainingSeconds: totalSeconds,
      totalSeconds,
      currentSession: nextSession,
      isPaused: !state.autoStartWork,
    });
  }
}
