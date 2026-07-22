import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { LANGUAGE_NAMES } from '../../i18n/translations';
import { NEU } from '../../utils/shadows';
import type { Language } from '@shared/types';

const LANGUAGES: Language[] = ['en', 'ru'];

export function LanguagePicker() {
  const language = useSettingsStore((s) => s.language);
  const update = useSettingsStore((s) => s.update);
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.language')}</h3>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((lang) => {
          const active = language === lang;
          return (
            <button
              key={lang}
              onClick={() => update({ language: lang })}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                active ? 'text-text-primary' : 'text-text-secondary'
              }`}
              style={{ boxShadow: active ? NEU.pressed : NEU.raisedSm }}
            >
              {LANGUAGE_NAMES[lang]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
