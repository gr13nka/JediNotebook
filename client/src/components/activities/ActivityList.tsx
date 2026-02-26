import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { Activity } from '@shared/types';
import { useActivities } from '../../hooks/useActivities';
import { useTimeEntries } from '../../hooks/useTimeEntries';
import { useTimer } from '../../hooks/useTimer';
import { useTranslation } from '../../i18n/useTranslation';
import { ActivityCard } from './ActivityCard';
import { ActivityForm } from './ActivityForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { NEU } from '../../utils/shadows';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export function ActivityList() {
  const { t } = useTranslation();
  const { activities, createActivity, updateActivity, deleteActivity } = useActivities();
  const { getElapsedForActivity } = useTimeEntries();
  const { isRunning, activeActivityId, elapsed, toggleTimer } = useTimer();
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-text-primary">{t('activities.title')}</h2>
        <Button size="sm" onClick={() => setShowForm(true)}>
          {t('activities.new')}
        </Button>
      </div>

      <motion.div
        className="flex flex-col gap-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {activities.map((activity) => {
          const isActive = isRunning && activeActivityId === activity.id;
          const storedElapsed = getElapsedForActivity(activity.id);
          const liveElapsed = isActive ? elapsed : 0;

          return (
            <motion.div key={activity.id} variants={item}>
              <ActivityCard
                activity={activity}
                elapsedSeconds={storedElapsed}
                liveElapsed={liveElapsed}
                isActive={isActive}
                onToggle={() => toggleTimer(activity.id)}
                onEdit={() => setEditingActivity(activity)}
                onDelete={() => setDeletingActivityId(activity.id)}
              />
            </motion.div>
          );
        })}
      </motion.div>

      {activities.length === 0 && (
        <motion.div
          className="text-center text-text-muted py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-4 flex justify-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ boxShadow: NEU.raised }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted/50">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <p>{t('activities.empty')}</p>
          <p className="text-sm mt-1">{t('activities.emptyHint')}</p>
        </motion.div>
      )}

      {/* Create form */}
      <ActivityForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={createActivity}
        usedColors={activities.map((a) => a.color)}
      />

      {/* Edit form */}
      <ActivityForm
        open={!!editingActivity}
        onClose={() => setEditingActivity(null)}
        onSubmit={(name, budgetMinutes, color) => {
          if (editingActivity) {
            updateActivity(editingActivity.id, { name, dailyBudgetMinutes: budgetMinutes, color });
          }
        }}
        usedColors={activities.map((a) => a.color)}
        initialName={editingActivity?.name ?? ''}
        initialBudget={editingActivity?.dailyBudgetMinutes ?? 60}
        initialColor={editingActivity?.color}
        title={t('activityForm.editTitle')}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingActivityId}
        onClose={() => setDeletingActivityId(null)}
        onConfirm={() => {
          if (deletingActivityId) deleteActivity(deletingActivityId);
        }}
        title={t('activities.delete')}
        message={t('activities.deleteConfirm')}
      />
    </div>
  );
}
