import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';

export function NavPositionPicker() {
  const { t } = useTranslation();
  const navPosition = useSettingsStore((s) => s.navPosition);
  const setNavPosition = useSettingsStore((s) => s.setNavPosition);

  const options: { value: 'left' | 'bottom' | 'dropdown'; label: string }[] = [
    { value: 'left', label: t('settings.navLeft') },
    { value: 'bottom', label: t('settings.navBottom') },
    { value: 'dropdown', label: t('settings.navDropdown') },
  ];

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.navPosition')}</h3>
      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => {
          const active = navPosition === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setNavPosition(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors bg-bg-card border ${
                active ? 'border-accent text-text-primary' : 'border-border text-text-secondary'
              }`}
              style={{
                boxShadow: active ? NEU.pressedSm : NEU.raisedSm,
              }}
            >
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
