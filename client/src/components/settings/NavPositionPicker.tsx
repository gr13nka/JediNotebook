import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';

export function NavPositionPicker() {
  const { t } = useTranslation();
  const navPosition = useSettingsStore((s) => s.navPosition);
  const update = useSettingsStore((s) => s.update);

  const options: { value: 'left' | 'bottom'; label: string }[] = [
    { value: 'left', label: t('settings.navLeft') },
    { value: 'bottom', label: t('settings.navBottom') },
  ];

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.navPosition')}</h3>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update({ navPosition: opt.value })}
            className="flex flex-col items-center gap-2 rounded-xl p-4 transition-colors bg-bg-card"
            style={{
              boxShadow: navPosition === opt.value
                ? NEU.pressedSm
                : NEU.raisedSm,
            }}
          >
            <span className="text-xs text-text-primary">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
