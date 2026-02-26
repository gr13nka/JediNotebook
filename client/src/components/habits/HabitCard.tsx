import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { WeeklyTracker } from './WeeklyTracker';
import { HabitProgressBar } from './HabitProgressBar';
import { useTranslation } from '../../i18n/useTranslation';
import type { Habit, HabitEntry } from '@shared/types';

const ICONS: Record<string, (color: string) => React.ReactNode> = {
  brain: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 3 1.5 5 3 6.5V22h8v-6.5c1.5-1.5 3-3.5 3-6.5a7 7 0 0 0-7-7z" />
      <path d="M9 22h6" /><path d="M10 2v2" /><path d="M14 2v2" />
    </svg>
  ),
  book: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  footprints: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16v-2.38C4 11.5 2.97 9.5 3 8c.03-1.5 1-3 2.5-3S8 5.5 8 8c0 1.5-.5 3.5-1 5.5L5 16" />
      <path d="M20 20v-2.38c0-2.12 1.03-4.12 1-5.62-.03-1.5-1-3-2.5-3S16 10.5 16 13c0 1.5.5 3.5 1 5.5l2 1.5" />
    </svg>
  ),
  droplet: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  fire: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.33-2.16 1-3 .17.84.67 1.5 1.5 2.5" />
    </svg>
  ),
  heart: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  star: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  dumbbell: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" /><path d="M6 6a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1V6z" />
      <path d="M3 8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1V8z" /><path d="M18 6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1V6z" />
      <path d="M21 8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1V8z" />
      <path d="M6 13a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v-5z" /><path d="M3 15a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1v-3z" />
      <path d="M18 13a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-5z" /><path d="M21 15a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1v-3z" />
    </svg>
  ),
};

const FireIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E04848" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.33-2.16 1-3 .17.84.67 1.5 1.5 2.5" />
  </svg>
);

interface HabitCardProps {
  habit: Habit;
  entries: HabitEntry[];
  weekDates: string[];
  today: string;
  streak: number;
  onToggle: (habitId: string, date: string) => void;
  onLog: (habitId: string, date: string, value: number) => void;
  onDelete: (id: string) => void;
}

export function HabitCard({ habit, entries, weekDates, today, streak, onToggle, onLog, onDelete }: HabitCardProps) {
  const { t } = useTranslation();
  const todayEntry = entries.find((e) => e.date === today);
  const todayValue = todayEntry?.value ?? 0;
  const isCompletedToday = todayEntry?.completed ?? false;
  const renderIcon = ICONS[habit.icon];

  return (
    <motion.div
      className="relative rounded-2xl bg-bg-card p-4 overflow-hidden"
      style={{ boxShadow: NEU.raised }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: habit.color }}
      />

      {/* Row 1: Icon + name + streak */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {renderIcon ? renderIcon(habit.color) : null}
          <span className="text-sm font-semibold text-text-primary">{habit.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {streak > 0 && (
            <>
              <FireIcon />
              <span className="text-xs font-bold text-text-secondary">{streak}</span>
            </>
          )}
          <button
            onClick={() => onDelete(habit.id)}
            className="ml-2 text-text-muted hover:text-red transition-colors p-0.5"
            title={t('habits.deleteTitle')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Row 2: Weekly tracker */}
      <div className="mb-3">
        <WeeklyTracker
          weekDates={weekDates}
          entries={entries}
          today={today}
          color={habit.color}
          targetValue={habit.targetValue}
        />
      </div>

      {/* Row 3: Action area */}
      {habit.type === 'boolean' ? (
        <button
          onClick={() => onToggle(habit.id, today)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            boxShadow: isCompletedToday ? NEU.pressed : NEU.raisedSm,
            color: isCompletedToday ? habit.color : undefined,
          }}
        >
          {isCompletedToday ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={habit.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{t('habits.done')}</span>
            </>
          ) : (
            <span className="text-text-secondary">{t('habits.markComplete')}</span>
          )}
        </button>
      ) : (
        <div>
          <HabitProgressBar
            value={todayValue}
            target={habit.targetValue}
            unit={habit.unit}
            color={habit.color}
          />
          <div className="flex gap-2 mt-2">
            {getQuickAddValues(habit).map((val) => (
              <button
                key={val}
                onClick={() => onLog(habit.id, today, val)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-text-secondary transition-all duration-200"
                style={{ boxShadow: NEU.raisedSm }}
              >
                +{val >= 1000 ? `${val / 1000}k` : val}
              </button>
            ))}
            {todayValue > 0 && (
              <button
                onClick={() => onLog(habit.id, today, -getQuickAddValues(habit)[0])}
                className="py-1.5 px-2 rounded-lg text-xs font-medium text-text-muted transition-all duration-200"
                style={{ boxShadow: NEU.raisedSm }}
              >
                -
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function getQuickAddValues(habit: Habit): number[] {
  if (habit.targetValue >= 10000) return [1000, 2500, 5000];
  if (habit.targetValue >= 100) return [10, 25, 50];
  if (habit.targetValue >= 10) return [1, 2, 5];
  return [1, 2, 3];
}
