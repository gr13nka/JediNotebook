import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';

const ZOOM_STEPS = [90, 100, 110, 120, 130];

export function ZoomSettings() {
  const { t } = useTranslation();
  const uiZoom = useSettingsStore((s) => s.uiZoom);
  const update = useSettingsStore((s) => s.update);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.uiZoom')}</h3>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const idx = ZOOM_STEPS.indexOf(uiZoom);
            if (idx > 0) update({ uiZoom: ZOOM_STEPS[idx - 1] });
          }}
          disabled={uiZoom <= ZOOM_STEPS[0]}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-elevated text-text-primary text-lg border border-border disabled:opacity-30 transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          &minus;
        </button>
        <span
          className="text-sm text-text-primary tabular-nums w-12 text-center rounded-lg h-8 flex items-center justify-center bg-bg-card border border-border"
          style={{ boxShadow: NEU.pressedSm }}
        >
          {uiZoom}%
        </span>
        <button
          onClick={() => {
            const idx = ZOOM_STEPS.indexOf(uiZoom);
            if (idx < ZOOM_STEPS.length - 1) update({ uiZoom: ZOOM_STEPS[idx + 1] });
          }}
          disabled={uiZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-elevated text-text-primary text-lg border border-border disabled:opacity-30 transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          +
        </button>
      </div>
    </div>
  );
}
