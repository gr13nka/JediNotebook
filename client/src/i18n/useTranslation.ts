import { useSettingsStore } from '../stores/settingsStore';
import { translations, type TranslationKey } from './translations';

export function useTranslation() {
  const language = useSettingsStore((s) => s.language);
  const dict = translations[language] ?? translations.en;

  function t(key: TranslationKey): string {
    return dict[key] ?? translations.en[key] ?? key;
  }

  return { t, language };
}
