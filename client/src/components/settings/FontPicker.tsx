import { useSettingsStore } from '../../stores/settingsStore';
import { FONT_PRESETS } from '../../theme/fonts';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';

export function FontPicker() {
  const { t } = useTranslation();
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.typeface')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FONT_PRESETS.map((preset) => {
          const active = fontFamily === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFontFamily(preset.id)}
              className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card ${
                active ? 'border-accent bg-bg-primary' : 'border-border bg-bg-card hover:border-text-muted'
              }`}
              style={{ boxShadow: active ? NEU.pressed : NEU.raisedSm, fontFamily: preset.family }}
            >
              <span className="absolute right-3 top-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-muted/65">
                {active ? t('settings.fontActive') : t('settings.fontPreview')}
              </span>
              <span className="block pr-16 text-lg leading-none text-text-primary">{t(preset.labelKey)}</span>
              <span className="mt-3 block text-base leading-tight text-text-primary">Make space for what matters.</span>
              <span className="mt-1 block text-sm leading-tight text-text-secondary">Заметки на сегодня</span>
              <span className="mt-3 block border-t border-border/70 pt-2 text-[11px] leading-snug text-text-muted">
                {t(preset.descriptionKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
