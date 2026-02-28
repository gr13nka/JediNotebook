import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';

const TOTAL_SECONDS = 300; // 5 minutes
const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownTimer() {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = () => {
    if (running) return;
    setFinished(false);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          stop();
          setFinished(true);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(t('mindmap.timerDone'));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const reset = () => {
    stop();
    setSeconds(TOTAL_SECONDS);
    setFinished(false);
  };

  const progress = seconds / TOTAL_SECONDS;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <motion.div
      className="rounded-2xl bg-bg-card p-4 flex flex-col items-center gap-3"
      style={{ boxShadow: NEU.raised }}
      animate={finished ? { scale: [1, 1.03, 1] } : undefined}
      transition={finished ? { repeat: Infinity, duration: 1 } : undefined}
    >
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80" className="rotate-[-90deg]">
          <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="var(--color-bar-track)" strokeWidth="5" />
          <circle
            cx="40" cy="40" r={RADIUS} fill="none"
            stroke="var(--color-accent)" strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold tabular-nums text-text-primary">
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        {!running ? (
          <button
            onClick={start}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-accent"
            style={{ boxShadow: NEU.raisedSm }}
          >
            {t('mindmap.timerStart')}
          </button>
        ) : null}
        <button
          onClick={reset}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-text-muted"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('mindmap.timerReset')}
        </button>
      </div>
    </motion.div>
  );
}
