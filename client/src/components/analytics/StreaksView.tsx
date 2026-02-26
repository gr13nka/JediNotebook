import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Card } from '../ui/Card';

export function StreaksView() {
  const { t } = useTranslation();
  const { getStreaks, getAverages } = useAnalytics();
  const [streaks, setStreaks] = useState<Awaited<ReturnType<typeof getStreaks>>>([]);
  const [averages, setAverages] = useState<Awaited<ReturnType<typeof getAverages>>>([]);

  useEffect(() => {
    getStreaks().then(setStreaks);
    getAverages(7).then(setAverages);
  }, []);

  const activeStreaks = streaks.filter((s) => s.currentStreak > 0 || s.longestStreak > 0);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-text-primary">{t('analytics.streaksTitle')}</h3>

      {activeStreaks.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {activeStreaks.map((s) => (
            <Card key={s.activityId}>
              <p className="text-sm text-text-secondary mb-1">{s.activityName}</p>
              <p className="text-2xl font-bold text-accent tabular-nums">
                {s.currentStreak}d
              </p>
              <p className="text-xs text-text-muted">
                {t('analytics.best')} {s.longestStreak}d
              </p>
            </Card>
          ))}
        </div>
      )}

      <h4 className="text-sm font-medium text-text-secondary mt-2">
        {t('analytics.avg7day')}
      </h4>
      {averages
        .filter((a) => a.avgSeconds > 0)
        .map((a) => (
          <div key={a.activityId} className="flex items-center justify-between py-1">
            <span className="text-sm text-text-primary">{a.activityName}</span>
            <span className="text-sm text-text-secondary tabular-nums">
              {Math.round(a.avgSeconds / 60)}{t('analytics.mDay')}
            </span>
          </div>
        ))}

      {activeStreaks.length === 0 && averages.every((a) => a.avgSeconds === 0) && (
        <p className="text-center text-text-muted py-8">
          {t('analytics.emptyStreaks')}
        </p>
      )}
    </div>
  );
}
