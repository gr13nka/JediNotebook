import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from '../../i18n/useTranslation';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getLogicalDate } from '../../utils/time';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { NEU } from '../../utils/shadows';
import { Card } from '../ui/Card';

export function MonthlyView() {
  const { t } = useTranslation();
  const { getMonthlySummary } = useAnalytics();
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);
  const colors = useThemeColors();
  const [data, setData] = useState<Awaited<ReturnType<typeof getMonthlySummary>>>([]);

  useEffect(() => {
    const today = getLogicalDate(dayStartHour);
    getMonthlySummary(today).then(setData);
  }, [dayStartHour]);

  const chartData = data.map((day) => ({
    name: day.label,
    total: Math.round(day.totalSeconds / 60),
  }));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-text-primary">{t('analytics.last30')}</h3>
      <Card>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.accent} stopOpacity={0.15} />
                <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tick={{ fill: colors.textSecondary, fontSize: 10 }}
              axisLine={{ stroke: colors.border }}
              tickLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fill: colors.textSecondary, fontSize: 12 }}
              axisLine={{ stroke: colors.border }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.bgPrimary,
                border: 'none',
                borderRadius: '12px',
                boxShadow: NEU.tooltipSm,
                color: colors.textPrimary,
              }}
              formatter={(value: number) => [`${value}m`, 'Total']}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={colors.accent}
              strokeWidth={2}
              fill="url(#totalGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
