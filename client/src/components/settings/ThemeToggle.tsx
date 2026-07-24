import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { CustomThemeEditor } from './CustomThemeEditor';
import { PREBUILT_THEMES, type PrebuiltTheme } from '../../theme/themes';

function WaxPreview({ theme }: { theme: PrebuiltTheme }) {
  const { bgPrimary, bgCard, accent, textPrimary } = theme.colors;

  return (
    <div
      className="wax-preview-art"
      style={{ backgroundColor: bgPrimary, color: textPrimary }}
    >
      <svg viewBox="0 0 240 108" aria-hidden="true" className="wax-preview-drawing">
        <path d="M16 76 C42 66 58 72 76 84 S111 104 130 88 C146 74 132 50 151 37 C165 27 167 14 184 11" />
        <path d="M54 30 L77 8 L89 40 Z" fill={bgCard} stroke="none" />
        <rect x="91" y="10" width="43" height="30" rx="1" fill={bgCard} stroke="none" />
        <circle cx="69" cy="58" r="20" fill={bgCard} stroke="none" />
        <path d="M108 59 L128 42 L147 59 L128 76 Z" fill={bgCard} stroke="none" />
        <path d="M35 72 C43 78 45 88 52 94 M44 70 C53 77 54 89 62 95 M54 70 C64 78 65 89 73 93" />
      </svg>
      <span className="wax-preview-accent" style={{ backgroundColor: accent }} />
    </div>
  );
}

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const customColors = useSettingsStore((s) => s.customThemeColors);
  const waxThemes = PREBUILT_THEMES.filter((preset) => preset.texture === 'wax-pencil');
  const otherThemes = PREBUILT_THEMES.filter((preset) => preset.texture !== 'wax-pencil');

  return (
    <div className="wax-theme-picker">
      <div className="wax-theme-heading">
        <div>
          <span className="wax-theme-eyebrow">MATERIAL / 01</span>
          <h3 className="wax-theme-title">{t('settings.themeWaxTitle')}</h3>
        </div>
        <span className="wax-theme-mark">✦</span>
      </div>
      <p className="wax-theme-description">{t('settings.themeWaxDesc')}</p>

      <div className="wax-theme-options">
        {waxThemes.map((preset) => {
          const active = theme === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(preset.id)}
              className={`wax-theme-option ${active ? 'is-active' : ''}`}
            >
              <WaxPreview theme={preset} />
              <span className="wax-theme-option-copy">
                <span className="wax-theme-option-name">{t(preset.labelKey)}</span>
                <span className="wax-theme-option-note">
                  {t(preset.dark ? 'settings.themeWaxDarkNote' : 'settings.themeWaxLightNote')}
                </span>
              </span>
              <span className="wax-theme-option-arrow" aria-hidden="true">↗</span>
            </button>
          );
        })}
      </div>

      <div className="wax-other-heading">
        <span>{t('settings.themeOtherPalettes')}</span>
        <span className="wax-other-rule" />
      </div>

      <div className="wax-other-palettes">
        {otherThemes.map((preset) => {
          const active = theme === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(preset.id)}
              className={`wax-palette-row ${active ? 'is-active' : ''}`}
            >
              <span className="wax-palette-dot" style={{ backgroundColor: preset.colors.accent }} />
              <span>{t(preset.labelKey)}</span>
              {active && <span className="wax-palette-check">✓</span>}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={theme === 'custom'}
          onClick={() => setTheme('custom')}
          className={`wax-palette-row ${theme === 'custom' ? 'is-active' : ''}`}
        >
          <span className="wax-palette-dot wax-palette-dot-custom" style={{ backgroundColor: customColors.accent }} />
          <span>{t('settings.themeCustom')}</span>
          {theme === 'custom' && <span className="wax-palette-check">✓</span>}
        </button>
      </div>

      {theme === 'custom' && <CustomThemeEditor />}
    </div>
  );
}
