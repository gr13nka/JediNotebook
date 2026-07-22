import React from 'react';
import { TimerDisplay } from '../components/timer/TimerDisplay';
import { ActivityList } from '../components/activities/ActivityList';
import { useTranslation } from '../i18n/useTranslation';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:hidden">
        <h1 className="text-xl font-bold text-accent">{t('nav.brand')}</h1>
      </div>

      <TimerDisplay />
      <ActivityList />
    </div>
  );
}
