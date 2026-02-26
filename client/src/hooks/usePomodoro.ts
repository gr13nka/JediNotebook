import { useEffect, useRef, useCallback } from 'react';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { PomodoroPreset, PomodoroPhase } from '@shared/types';

export function usePomodoro() {
  const workerRef = useRef<Worker | null>(null);
  const prevPhaseRef = useRef<PomodoroPhase>('work');

  const {
    isActive,
    isPaused,
    phase,
    remainingSeconds,
    totalSeconds,
    currentSession,
    sessionsBeforeLongBreak,
    linkedActivityId,
    selectedPresetId,
    startSession,
    pause,
    resume,
    skip,
    stop: storeStop,
    tick,
    setLinkedActivity,
    setSelectedPreset,
  } = usePomodoroStore();

  // Worker lifecycle
  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/pomodoro.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'tick') {
          usePomodoroStore.getState().tick();
        }
      };
    }

    if (isActive && !isPaused) {
      workerRef.current.postMessage({ type: 'start' });
    } else {
      workerRef.current.postMessage({ type: 'stop' });
    }
  }, [isActive, isPaused]);

  // Activity integration: start/stop activity timer on phase changes
  useEffect(() => {
    if (!isActive || !linkedActivityId) return;

    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    const timerStore = useTimerStore.getState();
    const dayStartHour = useSettingsStore.getState().dayStartHour;

    if (phase === 'work' && !isPaused) {
      // Start activity timer for work phase
      if (!timerStore.isRunning || timerStore.activeActivityId !== linkedActivityId) {
        timerStore.start(linkedActivityId, dayStartHour);
      }
    } else if (prevPhase === 'work' && phase !== 'work') {
      // Transitioning away from work — stop activity timer
      if (timerStore.isRunning && timerStore.activeActivityId === linkedActivityId) {
        timerStore.stop();
      }
    }
  }, [phase, isActive, isPaused, linkedActivityId]);

  // Notification on phase transitions
  useEffect(() => {
    if (!isActive) return;

    const prevPhase = prevPhaseRef.current;
    if (prevPhase === phase) return;

    const labels: Record<PomodoroPhase, string> = {
      work: 'Work time!',
      break: 'Break time!',
      longBreak: 'Long break!',
    };

    if (Notification.permission === 'granted') {
      new Notification('Pomodoro', { body: labels[phase] });
    }
  }, [phase, isActive]);

  const startPomodoro = useCallback(
    (preset: PomodoroPreset) => {
      const activityId = usePomodoroStore.getState().linkedActivityId;
      startSession({
        workMinutes: preset.workMinutes,
        breakMinutes: preset.breakMinutes,
        longBreakMinutes: preset.longBreakMinutes,
        sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
        autoStartBreaks: preset.autoStartBreaks,
        autoStartWork: preset.autoStartWork,
        presetId: preset.id,
        linkedActivityId: activityId,
      });

      // Request notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    },
    [startSession],
  );

  const stop = useCallback(() => {
    // Stop linked activity timer if running
    const timerStore = useTimerStore.getState();
    const { linkedActivityId } = usePomodoroStore.getState();
    if (linkedActivityId && timerStore.isRunning && timerStore.activeActivityId === linkedActivityId) {
      timerStore.stop();
    }
    storeStop();
  }, [storeStop]);

  return {
    isActive,
    isPaused,
    phase,
    remainingSeconds,
    totalSeconds,
    currentSession,
    sessionsBeforeLongBreak,
    linkedActivityId,
    selectedPresetId,
    startPomodoro,
    pause,
    resume,
    skip,
    stop,
    setLinkedActivity,
    setSelectedPreset,
  };
}
