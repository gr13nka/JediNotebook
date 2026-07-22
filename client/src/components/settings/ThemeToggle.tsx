import { useTranslation } from '../../i18n/useTranslation';
import type { TranslationKey } from '../../i18n/translations';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';
import { CustomThemeEditor } from './CustomThemeEditor';
import type { ThemeMode } from '@shared/types';

interface ThemeSwatch {
  id: ThemeMode;
  labelKey: TranslationKey;
  bg: string;
  card: string;
  accent: string;
}

const THEMES: ThemeSwatch[] = [
  { id: 'light', labelKey: 'settings.themeLight', bg: '#F0F1F4', card: '#FAFBFC', accent: '#1F2937' },
  { id: 'dark',  labelKey: 'settings.themeDark',  bg: '#1e1e1e', card: '#262626', accent: '#7f6df2' },
];

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);
  const customColors = useSettingsStore((s) => s.customThemeColors);

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {THEMES.map((swatch) => {
          const active = theme === swatch.id;
          return (
            <button
              key={swatch.id}
              type="button"
              onClick={() => update({ theme: swatch.id })}
              className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all border-2 ${
                active
                  ? 'border-accent'
                  : 'border-transparent hover:border-border'
              }`}
              style={active ? { boxShadow: NEU.pressedSm } : undefined}
            >
              <div
                className="w-full aspect-[4/3] rounded-md overflow-hidden flex flex-col"
                style={{ backgroundColor: swatch.bg }}
              >
                <div className="flex-1" />
                <div className="flex gap-0.5 px-1 pb-1">
                  <div
                    className="flex-1 h-2 rounded-sm"
                    style={{ backgroundColor: swatch.card }}
                  />
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: swatch.accent }}
                  />
                </div>
              </div>
              <span className={`text-xs font-medium leading-tight text-center ${
                active ? 'text-text-primary' : 'text-text-secondary'
              }`}>
                {t(swatch.labelKey)}
              </span>
            </button>
          );
        })}

        {/* Custom theme swatch */}
        <button
          type="button"
          onClick={() => update({ theme: 'custom' })}
          className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all border-2 ${
            theme === 'custom'
              ? 'border-accent'
              : 'border-transparent hover:border-border'
          }`}
          style={theme === 'custom' ? { boxShadow: NEU.pressedSm } : undefined}
        >
          <div
            className="w-full aspect-[4/3] rounded-md overflow-hidden flex flex-col"
            style={{ backgroundColor: customColors.bgPrimary }}
          >
            <div className="flex-1" />
            <div className="flex gap-0.5 px-1 pb-1">
              <div
                className="flex-1 h-2 rounded-sm"
                style={{ backgroundColor: customColors.bgCard }}
              />
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: customColors.accent }}
              />
            </div>
          </div>
          <span className={`text-xs font-medium leading-tight text-center ${
            theme === 'custom' ? 'text-text-primary' : 'text-text-secondary'
          }`}>
            {t('settings.themeCustom')}
          </span>
        </button>
      </div>

      {theme === 'custom' && <CustomThemeEditor />}
    </div>
  );
}
