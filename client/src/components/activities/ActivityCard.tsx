import React from 'react';
import { motion } from 'motion/react';
import type { Activity } from '@shared/types';
import { ProgressBar } from '../progress/ProgressBar';
import { formatDuration, getProgressRatio } from '../../utils/time';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';
import { ActivityMenu } from './ActivityMenu';

interface ActivityCardProps {
  activity: Activity;
  elapsedSeconds: number;
  liveElapsed: number;
  isActive: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
}

export function ActivityCard({
  activity,
  elapsedSeconds,
  liveElapsed,
  isActive,
  onToggle,
  onEdit,
  onDelete,
  onLongPress,
}: ActivityCardProps) {
  const { t } = useTranslation();
  const totalElapsed = elapsedSeconds + liveElapsed;
  const ratio = getProgressRatio(totalElapsed, activity.dailyBudgetMinutes);
  const budgetSeconds = activity.dailyBudgetMinutes * 60;
  const remaining = Math.max(0, budgetSeconds - totalElapsed);

  return (
    <motion.div
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onToggle}
      className="relative rounded-2xl p-4 cursor-pointer group"
      style={isActive ? {
        boxShadow: `${NEU.pressed}, inset 0 0 0 2px ${activity.color}60`,
        background: `color-mix(in srgb, ${activity.color} 12%, var(--color-bg-card))`,
      } : {
        boxShadow: NEU.raised,
        background: 'var(--color-bg-card)',
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{
          backgroundColor: activity.color,
        }}
      />

      {/* 3-dot menu */}
      {onEdit && onDelete && (
        <div className="absolute top-2 right-2">
          <ActivityMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}

      <div className="flex items-center justify-between mb-3 pl-3 pr-8">
        <div className="flex items-center gap-3">
          <span className={`font-medium ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
            {activity.name}
          </span>
          {isActive && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                color: activity.color,
                backgroundColor: `${activity.color}15`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: activity.color,
                  animation: 'breathe 2s ease-in-out infinite',
                }}
              />
              {t('activities.live')}
            </span>
          )}
        </div>
        <span
          className={`tabular-nums ${isActive ? 'text-xl font-bold' : 'text-sm text-text-secondary'}`}
          style={{
            fontVariantNumeric: 'tabular-nums',
            ...(isActive ? {
              color: activity.color,
            } : {}),
          }}
        >
          {formatDuration(totalElapsed)}
        </span>
      </div>

      <div className="pl-3">
        <ProgressBar ratio={ratio} color={activity.color} isActive={isActive} />
      </div>

      <div className="flex justify-between mt-2 pl-3">
        <span className="text-xs text-text-muted">
          {Math.round(ratio * 100)}%
        </span>
        <span className="text-xs text-text-muted">
          {remaining > 0
            ? `${formatDuration(remaining)} ${t('activities.left')}`
            : ratio > 1
              ? t('activities.overBudget')
              : t('activities.complete')}
        </span>
      </div>
    </motion.div>
  );
}
