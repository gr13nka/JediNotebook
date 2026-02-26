import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTimerStore } from '../../stores/timerStore';
import { useActivities } from '../../hooks/useActivities';
import { formatDuration } from '../../utils/time';
import { NEU } from '../../utils/shadows';

export function TimerDisplay() {
  const { isRunning, activeActivityId, elapsed } = useTimerStore();
  const { activities } = useActivities();

  const activity = isRunning && activeActivityId
    ? activities.find((a) => a.id === activeActivityId)
    : null;

  return (
    <AnimatePresence>
      {activity && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative rounded-xl p-4 mb-4 overflow-hidden"
          style={{
            boxShadow: `${NEU.pressed}, inset 0 0 0 2px ${activity.color}50`,
            background: `color-mix(in srgb, ${activity.color} 10%, var(--color-bg-card))`,
          }}
        >
          <div className="relative flex items-center gap-3">
            <div className="relative">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activity.color }}
              />
            </div>
            <span className="text-sm font-medium text-text-primary flex-1">
              {activity.name}
            </span>
            <span
              className="text-2xl font-semibold text-accent"
              style={{
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatDuration(elapsed)}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
