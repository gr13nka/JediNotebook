import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';
import type { ThemeMode } from '@shared/types';

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);

  const isNeu = theme === 'neu-light' || theme === 'neu-dark';
  const isDark = theme === 'dark' || theme === 'neu-dark';

  const setStyle = (neu: boolean) => {
    const next: ThemeMode = neu
      ? (isDark ? 'neu-dark' : 'neu-light')
      : (isDark ? 'dark' : 'light');
    update({ theme: next });
  };

  const setColor = (dark: boolean) => {
    const next: ThemeMode = isNeu
      ? (dark ? 'neu-dark' : 'neu-light')
      : (dark ? 'dark' : 'light');
    update({ theme: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">{t('settings.themeStyle')}</h3>
        <div
          className="flex gap-1 rounded-lg p-1 bg-bg-card border border-border"
          style={{ boxShadow: NEU.pressed }}
        >
          {([false, true] as const).map((neu) => {
            const active = isNeu === neu;
            return (
              <button
                key={neu ? 'neu' : 'flat'}
                type="button"
                onClick={() => setStyle(neu)}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active ? 'text-text-primary bg-bg-primary border border-border' : 'text-text-secondary'
                }`}
                style={active ? { boxShadow: NEU.raisedSm } : undefined}
              >
                {neu ? t('settings.theme3d') : t('settings.themeFlat')}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">{t('settings.themeColor')}</h3>
        <div
          className="flex gap-1 rounded-lg p-1 bg-bg-card border border-border"
          style={{ boxShadow: NEU.pressed }}
        >
          {([false, true] as const).map((dark) => {
            const active = isDark === dark;
            return (
              <button
                key={dark ? 'dark' : 'light'}
                type="button"
                onClick={() => setColor(dark)}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active ? 'text-text-primary bg-bg-primary border border-border' : 'text-text-secondary'
                }`}
                style={active ? { boxShadow: NEU.raisedSm } : undefined}
              >
                {dark ? t('settings.themeDark') : t('settings.themeLight')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
