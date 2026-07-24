import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { FreeNumberControl } from './FreeNumberControl';

export function ZoomSettings() {
  const { t } = useTranslation();
  const uiZoom = useSettingsStore((s) => s.uiZoom);
  const setZoom = useSettingsStore((s) => s.setZoom);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.uiZoom')}</h3>
      <FreeNumberControl
        value={uiZoom}
        min={25}
        suffix="%"
        onChange={setZoom}
        onReset={() => setZoom(100)}
        resetLabel={t('settings.reset')}
      />
    </div>
  );
}
