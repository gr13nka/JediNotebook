import React, { useState } from 'react';
import { TimerDisplay } from '../components/timer/TimerDisplay';
import { PomodoroTimer } from '../components/pomodoro/PomodoroTimer';
import { ActivityList } from '../components/activities/ActivityList';
import { FatigueCheck } from '../components/fatigue/FatigueCheck';
import { Modal } from '../components/ui/Modal';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { useTranslation } from '../i18n/useTranslation';
import { NEU } from '../utils/shadows';
import { StreakXPBanner } from '../components/gamification/StreakXPBanner';

const TomatoIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c-1.5 0-2.5-.5-3-1.5C10 2 11 2.5 12 2.5S14 2 15 1.5C14.5 2.5 13.5 3 12 3z" fill="#4CAF50" stroke="#388E3C" strokeWidth="1.5" />
    <ellipse cx="12" cy="14" rx="8" ry="7.5" fill="#E74C3C" stroke="#C0392B" strokeWidth="1.5" />
    <path d="M12 6.5c-2 0-4 .8-5.2 2" stroke="#EF5350" strokeWidth="1.5" fill="none" />
  </svg>
);

const ZapIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export function HomePage() {
  const { t } = useTranslation();
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [showFatigue, setShowFatigue] = useState(false);
  const isActive = usePomodoroStore((s) => s.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:hidden">
        <h1 className="text-xl font-bold text-accent">{t('nav.brand')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFatigue(true)}
            className="p-2 rounded-xl transition-colors text-text-secondary"
            style={{ boxShadow: NEU.raisedSm }}
            title="Fatigue Check"
          >
            <ZapIcon />
          </button>
          <button
            onClick={() => setShowPomodoro(true)}
            className="relative p-2 rounded-xl transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
            title={t('pomodoro.timerTitle')}
          >
            <TomatoIcon />
            {isActive && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red"
                style={{ animation: 'breathe 2s ease-in-out infinite' }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Desktop: show buttons in-line */}
      <div className="hidden md:flex items-center justify-end gap-2 mb-4">
        <button
          onClick={() => setShowFatigue(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          <ZapIcon size={18} />
          <span>Fatigue Check</span>
        </button>
        <button
          onClick={() => setShowPomodoro(true)}
          className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          <TomatoIcon size={18} />
          <span>{t('pomodoro.title')}</span>
          {isActive && (
            <span
              className="w-2 h-2 rounded-full bg-red"
              style={{ animation: 'breathe 2s ease-in-out infinite' }}
            />
          )}
        </button>
      </div>

      <StreakXPBanner />
      <TimerDisplay />
      <ActivityList />

      <Modal open={showPomodoro} onClose={() => setShowPomodoro(false)} title={t('pomodoro.timerTitle')}>
        <PomodoroTimer embedded />
      </Modal>

      <FatigueCheck open={showFatigue} onClose={() => setShowFatigue(false)} />
    </div>
  );
}
