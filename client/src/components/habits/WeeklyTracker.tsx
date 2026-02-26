import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import type { HabitEntry } from '@shared/types';

interface WeeklyTrackerProps {
  weekDates: string[];
  entries: HabitEntry[];
  today: string;
  color: string;
  targetValue: number;
}

export function WeeklyTracker({ weekDates, entries, today, color, targetValue }: WeeklyTrackerProps) {
  const { t } = useTranslation();
  const dayLabels = [t('days.mon'), t('days.tue'), t('days.wed'), t('days.thu'), t('days.fri'), t('days.sat'), t('days.sun')];
  const entryMap = new Map(entries.map((e) => [e.date, e]));

  return (
    <div className="flex items-center justify-between gap-1">
      {weekDates.map((date, i) => {
        const entry = entryMap.get(date);
        const isToday = date === today;
        const isFuture = date > today;
        const isCompleted = entry?.completed ?? false;
        const hasPartial = entry && !entry.completed && entry.value > 0 && targetValue > 1;
        const progress = hasPartial ? entry.value / targetValue : 0;

        return (
          <div key={date} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-muted">{dayLabels[i]}</span>
            <div
              className="relative w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                boxShadow: isCompleted
                  ? NEU.raisedSm
                  : NEU.pressedSm,
                backgroundColor: isCompleted ? color : undefined,
                opacity: isFuture ? 0.4 : 1,
              }}
            >
              {isCompleted && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {hasPartial && (
                <svg width="22" height="22" viewBox="0 0 22 22" className="absolute">
                  <circle
                    cx="11" cy="11" r="9"
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeDasharray={`${progress * 56.5} 56.5`}
                    strokeLinecap="round"
                    transform="rotate(-90 11 11)"
                    opacity={0.6}
                  />
                </svg>
              )}
              {isToday && !isCompleted && !hasPartial && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color, opacity: 0.5 }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
