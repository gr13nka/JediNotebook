import { useEffect, useRef } from 'react';
import { useTaskTimerStore } from '../stores/taskTimerStore';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';

// Module-level singleton worker — prevents orphaned workers
let taskTimerWorker: Worker | null = null;
let workerListenerAttached = false;

function getTaskTimerWorker(): Worker {
  if (!taskTimerWorker) {
    taskTimerWorker = new Worker(
      new URL('../workers/pomodoro.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return taskTimerWorker;
}

// Attach the tick listener once at module level so it survives unmounts
function ensureWorkerListener() {
  if (workerListenerAttached) return;
  const worker = getTaskTimerWorker();
  worker.onmessage = () => {
    useTaskTimerStore.getState().tick();
  };
  workerListenerAttached = true;
}

export function useTaskTimer() {
  const { activeTaskId, linkedActivityId, remainingSeconds, totalSeconds, isActive, isPaused, countdownComplete, overtimeSeconds } =
    useTaskTimerStore();
  const taskTimerMinutes = useSettingsStore((s) => s.taskTimerMinutes);
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);
  const notifiedRef = useRef(false);

  // Ensure worker listener is attached
  useEffect(() => {
    ensureWorkerListener();
  }, []);

  // Start/stop worker based on active state
  useEffect(() => {
    const worker = getTaskTimerWorker();
    if (isActive && !isPaused) {
      worker.postMessage({ type: 'start' });
    } else {
      worker.postMessage({ type: 'stop' });
    }
  }, [isActive, isPaused]);

  // Fire notification when countdown completes
  useEffect(() => {
    if (countdownComplete && !notifiedRef.current) {
      notifiedRef.current = true;
      if (Notification.permission === 'granted') {
        new Notification('Task Timer Complete', {
          body: 'Your task timer has finished. Keep going or stop when ready.',
        });
      }
    }
    if (!countdownComplete) {
      notifiedRef.current = false;
    }
  }, [countdownComplete]);

  const startTask = (todayTaskId: string, projectId: string, taskLinkedActivityId: string | null) => {
    const store = useTaskTimerStore.getState();
    // Stop any currently active task timer
    if (store.isActive) {
      stopTask();
    }

    const totalSec = taskTimerMinutes * 60;

    // Request notification permission if needed
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // Start countdown
    useTaskTimerStore.getState().start({
      taskId: todayTaskId,
      linkedActivityId: taskLinkedActivityId,
      totalSeconds: totalSec,
    });

    // Start linked activity timer if applicable
    if (taskLinkedActivityId) {
      useTimerStore.getState().start(taskLinkedActivityId, dayStartHour);
    }
  };

  const pauseTask = () => {
    useTaskTimerStore.getState().pause();
  };

  const resumeTask = () => {
    useTaskTimerStore.getState().resume();
  };

  const stopTask = () => {
    const store = useTaskTimerStore.getState();
    // Stop linked activity timer if it's still running for this activity
    if (store.linkedActivityId) {
      const timerState = useTimerStore.getState();
      if (timerState.isRunning && timerState.activeActivityId === store.linkedActivityId) {
        useTimerStore.getState().stop();
      }
    }
    useTaskTimerStore.getState().stop();
  };

  const formatCountdown = (): string => {
    if (countdownComplete) {
      const m = Math.floor(overtimeSeconds / 60);
      const s = overtimeSeconds % 60;
      return `+${m}:${s.toString().padStart(2, '0')}`;
    }
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return {
    activeTaskId,
    linkedActivityId,
    remainingSeconds,
    totalSeconds,
    isActive,
    isPaused,
    countdownComplete,
    overtimeSeconds,
    startTask,
    pauseTask,
    resumeTask,
    stopTask,
    formatCountdown,
  };
}
