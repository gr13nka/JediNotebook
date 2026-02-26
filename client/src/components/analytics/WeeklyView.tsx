import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTranslation } from '../../i18n/useTranslation';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getLogicalDate } from '../../utils/time';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { NEU } from '../../utils/shadows';
import { Card } from '../ui/Card';

export function WeeklyView() {
  const { t } = useTranslation();
  const { getWeeklySummary, activities } = useAnalytics();
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);
  const colors = useThemeColors();
  const [data, setData] = useState<Awaited<ReturnType<typeof getWeeklySummary>>>([]);

  useEffect(() => {
    const today = getLogicalDate(dayStartHour);
    getWeeklySummary(today).then(setData);
  }, [dayStartHour]);

  const chartData = data.map((day) => {
    const row: Record<string, string | number> = { name: day.label };
    day.activities.forEach((a) => {
      row[a.activityName] = Math.round(a.totalSeconds / 60);
    });
    return row;
  });

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-text-primary">{t('analytics.thisWeek')}</h3>
      <Card>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="name"
              tick={{ fill: colors.textSecondary, fontSize: 12 }}
              axisLine={{ stroke: colors.border }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: colors.textSecondary, fontSize: 12 }}
              axisLine={{ stroke: colors.border }}
              tickLine={false}
              label={{
                value: t('analytics.min'),
                angle: -90,
                position: 'insideLeft',
                fill: colors.textSecondary,
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.bgPrimary,
                border: 'none',
                borderRadius: '12px',
                boxShadow: NEU.tooltipSm,
                color: colors.textPrimary,
              }}
              formatter={(value: number) => [`${value}m`, undefined]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: colors.textSecondary }}
            />
            {activities.map((a) => (
              <Bar
                key={a.id}
                dataKey={a.name}
                stackId="a"
                fill={a.color}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
