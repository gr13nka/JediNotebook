import { useSettingsStore } from '../../stores/settingsStore';
import { Toggle } from '../ui/Toggle';
import { useTranslation } from '../../i18n/useTranslation';

export function MobileProjectSettings() {
  const { t } = useTranslation();
  const mobileProjectGrid = useSettingsStore((s) => s.mobileProjectGrid);
  const update = useSettingsStore((s) => s.update);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-primary">{t('settings.mobileProjectGrid')}</span>
        <Toggle
          checked={mobileProjectGrid}
          onChange={(v) => update({ mobileProjectGrid: v })}
        />
      </div>
      <span className="text-[11px] text-text-muted">{t('settings.mobileProjectGridDesc')}</span>
    </div>
  );
}
