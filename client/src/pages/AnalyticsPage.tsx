import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../i18n/useTranslation';
import { NEU } from '../utils/shadows';
import { DailyView } from '../components/analytics/DailyView';
import { WeeklyView } from '../components/analytics/WeeklyView';
import { MonthlyView } from '../components/analytics/MonthlyView';
import { StreaksView } from '../components/analytics/StreaksView';

type Tab = 'daily' | 'weekly' | 'monthly' | 'streaks';

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('daily');

  const tabs: { value: Tab; label: string }[] = [
    { value: 'daily', label: t('analytics.daily') },
    { value: 'weekly', label: t('analytics.weekly') },
    { value: 'monthly', label: t('analytics.monthly') },
    { value: 'streaks', label: t('analytics.streaks') },
  ];

  return (
    <div>
      <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">{t('analytics.title')}</h1>
      <div
        className="flex gap-1 mb-6 bg-bg-card rounded-lg p-1"
        style={{
          boxShadow: NEU.pressed,
        }}
      >
        {tabs.map((tb) => (
          <button
            key={tb.value}
            onClick={() => setTab(tb.value)}
            className={`relative flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === tb.value
                ? 'text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === tb.value && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-md bg-bg-primary"
                style={{
                  boxShadow: NEU.raisedSm,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tb.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'daily' && <DailyView />}
          {tab === 'weekly' && <WeeklyView />}
          {tab === 'monthly' && <MonthlyView />}
          {tab === 'streaks' && <StreaksView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
