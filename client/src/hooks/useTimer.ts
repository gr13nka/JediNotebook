import { useEffect, useRef } from 'react';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Module-level singleton worker — prevents orphaned workers from
// React StrictMode double-mount or HMR re-mounts.
let timerWorker: Worker | null = null;

function getTimerWorker(): Worker {
  if (!timerWorker) {
    timerWorker = new Worker(
      new URL('../workers/timer.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return timerWorker;
}

export function useTimer() {
  const { isRunning, startedAt, activeActivityId, elapsed, start, stop, tick, restore } =
    useTimerStore();
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);
  const timerNotificationsEnabled = useSettingsStore((s) => s.timerNotificationsEnabled);
  const timerNotificationIntervalMinutes = useSettingsStore((s) => s.timerNotificationIntervalMinutes);
  const lastNotifiedRef = useRef(0);

  useEffect(() => {
    restore();
  }, []);

  useEffect(() => {
    const worker = getTimerWorker();
    worker.onmessage = (e) => {
      if (e.data.type === 'tick') {
        tick(e.data.elapsed);

        const intervalSeconds = timerNotificationIntervalMinutes * 60;
        if (
          timerNotificationsEnabled &&
          intervalSeconds > 0 &&
          e.data.elapsed >= lastNotifiedRef.current + intervalSeconds
        ) {
          lastNotifiedRef.current =
            Math.floor(e.data.elapsed / intervalSeconds) * intervalSeconds;
          if (Notification.permission === 'granted') {
            new Notification('Timer Running', {
              body: `${formatElapsed(e.data.elapsed)} elapsed`,
            });
          }
        }
      }
    };

    if (isRunning && startedAt) {
      lastNotifiedRef.current = 0;
      if (timerNotificationsEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
      worker.postMessage({ type: 'start', startedAt });
    } else {
      worker.postMessage({ type: 'stop' });
    }
  }, [isRunning, startedAt, timerNotificationsEnabled, timerNotificationIntervalMinutes]);

  // Handle visibility change for mobile backgrounding
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunning && startedAt) {
        const elapsed = Math.floor(
          (Date.now() - new Date(startedAt).getTime()) / 1000,
        );
        tick(elapsed);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning, startedAt]);

  const startTimer = (activityId: string) => start(activityId, dayStartHour);

  const toggleTimer = async (activityId: string) => {
    if (isRunning && activeActivityId === activityId) {
      await stop();
    } else {
      await startTimer(activityId);
    }
  };

  return {
    isRunning,
    activeActivityId,
    elapsed,
    startTimer,
    stopTimer: stop,
    toggleTimer,
  };
}
