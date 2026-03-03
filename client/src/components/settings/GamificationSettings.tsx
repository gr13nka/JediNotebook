import { useSettingsStore } from '../../stores/settingsStore';
import { getLevel } from '../../utils/streak';
import { Toggle } from '../ui/Toggle';
import { useTranslation } from '../../i18n/useTranslation';

export function GamificationSettings() {
  const { t } = useTranslation();
  const gamificationEnabled = useSettingsStore((s) => s.gamificationEnabled);
  const currentStreak = useSettingsStore((s) => s.currentStreak);
  const longestStreak = useSettingsStore((s) => s.longestStreak);
  const totalXP = useSettingsStore((s) => s.totalXP);
  const update = useSettingsStore((s) => s.update);

  const level = getLevel(totalXP);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-primary">{t('gamification.enable')}</span>
        <Toggle
          checked={gamificationEnabled}
          onChange={(v) => update({ gamificationEnabled: v })}
        />
      </div>

      {gamificationEnabled && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-bold text-text-primary tabular-nums">{currentStreak}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">{t('gamification.currentStreak')}</div>
          </div>
          <div>
            <div className="text-xl font-bold text-text-primary tabular-nums">{longestStreak}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">{t('gamification.bestStreak')}</div>
          </div>
          <div>
            <div className="text-xl font-bold text-text-primary tabular-nums">{level}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">{t('gamification.level')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
