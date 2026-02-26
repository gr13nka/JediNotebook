import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { Toggle } from '../ui/Toggle';
import { NEU } from '../../utils/shadows';

export function TimerNotificationSettings() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.timerNotificationsEnabled);
  const interval = useSettingsStore((s) => s.timerNotificationIntervalMinutes);
  const update = useSettingsStore((s) => s.update);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.timerNotifications')}</h3>
      <div className="flex flex-col gap-4">
        <Toggle
          checked={enabled}
          onChange={(checked) => update({ timerNotificationsEnabled: checked })}
          label={t('settings.timerNotifications')}
        />
        {enabled && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">{t('settings.notifyEvery')}</span>
            <button
              onClick={() => update({ timerNotificationIntervalMinutes: Math.max(5, interval - 5) })}
              disabled={interval <= 5}
              className="w-8 h-8 rounded-lg text-text-primary font-medium disabled:opacity-40 transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              −
            </button>
            <span
              className="w-10 h-8 flex items-center justify-center rounded-lg text-sm font-semibold text-text-primary"
              style={{ boxShadow: NEU.pressedSm }}
            >
              {interval}
            </span>
            <button
              onClick={() => update({ timerNotificationIntervalMinutes: Math.min(120, interval + 5) })}
              disabled={interval >= 120}
              className="w-8 h-8 rounded-lg text-text-primary font-medium disabled:opacity-40 transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              +
            </button>
            <span className="text-xs text-text-muted">{t('settings.minutes')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
