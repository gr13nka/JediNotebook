import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Toggle } from '../ui/Toggle';

export function TimeTrackingSettings() {
  const { t } = useTranslation();
  const visible = useSettingsStore((s) => s.timeTrackingVisible);
  const setVisible = useSettingsStore((s) => s.setTimeTrackingVisible);

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-medium text-text-secondary">{t('settings.timeTracking')}</h3>
        <p className="text-xs text-text-muted mt-0.5">{t('settings.timeTrackingDesc')}</p>
      </div>
      <Toggle checked={visible} onChange={setVisible} />
    </div>
  );
}
