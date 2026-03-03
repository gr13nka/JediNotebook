import { motion } from 'motion/react';
import { useSettingsStore } from '../../stores/settingsStore';
import { getLevel, getLevelProgress } from '../../utils/streak';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';

const FireIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" fill="#FF6B35" stroke="#E85D26" />
  </svg>
);

export function StreakXPBanner() {
  const { t } = useTranslation();
  const gamificationEnabled = useSettingsStore((s) => s.gamificationEnabled);
  const currentStreak = useSettingsStore((s) => s.currentStreak);
  const totalXP = useSettingsStore((s) => s.totalXP);
  const todayXP = useSettingsStore((s) => s.todayXP);

  if (!gamificationEnabled) return null;

  const level = getLevel(totalXP);
  const { ratio } = getLevelProgress(totalXP);

  return (
    <div
      className="flex items-center gap-4 rounded-2xl bg-bg-card p-3 mb-4"
      style={{ boxShadow: NEU.raised }}
    >
      {/* Streak */}
      <div className="flex items-center gap-1.5 shrink-0">
        <FireIcon />
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-bold text-text-primary tabular-nums">{currentStreak}</span>
          <span className="text-[10px] text-text-muted">{t('gamification.streak')}</span>
        </div>
      </div>

      <div className="w-px h-8 bg-border shrink-0" />

      {/* Level + XP */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-text-primary">
            {t('gamification.level')} {level}
          </span>
          <span className="text-xs text-text-muted">
            +{todayXP} {t('gamification.xpToday')}
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-bar-track overflow-hidden"
          style={{ boxShadow: NEU.pressedSm }}
        >
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(ratio * 100, 100)}%` }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </div>
      </div>
    </div>
  );
}
