import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useSettingsStore } from '../../stores/settingsStore';
import { getLogicalDate, formatDurationLong } from '../../utils/time';
import { Card } from '../ui/Card';
import { ThickLinearBar } from '../progress/ThickLinearBar';
import { getProgressRatio } from '../../utils/time';

export function DailyView() {
  const { t } = useTranslation();
  const { getDailySummary } = useAnalytics();
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDailySummary>>>([]);

  useEffect(() => {
    const date = getLogicalDate(dayStartHour);
    getDailySummary(date).then(setData);
    const interval = setInterval(() => {
      getDailySummary(date).then(setData);
    }, 5000);
    return () => clearInterval(interval);
  }, [dayStartHour]);

  const totalSeconds = data.reduce((sum, d) => sum + d.totalSeconds, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{t('analytics.today')}</h3>
        <span className="text-sm text-text-secondary">
          {t('analytics.total')} {formatDurationLong(totalSeconds)}
        </span>
      </div>

      {data.map((item) => (
        <Card key={item.activityId}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium text-text-primary">
                {item.activityName}
              </span>
            </div>
            <span className="text-sm text-text-secondary tabular-nums">
              {formatDurationLong(item.totalSeconds)} / {item.budgetMinutes}m
            </span>
          </div>
          <ThickLinearBar
            ratio={getProgressRatio(item.totalSeconds, item.budgetMinutes)}
            color={item.color}
          />
        </Card>
      ))}

      {data.length === 0 && (
        <p className="text-center text-text-muted py-8">{t('analytics.noData')}</p>
      )}
    </div>
  );
}
