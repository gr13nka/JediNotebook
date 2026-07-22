import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';

const ACCENT_PRESETS = [
  { color: '', label: 'Default' },
  { color: '#7f6df2', label: 'Purple' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#10b981', label: 'Green' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#ef4444', label: 'Red' },
  { color: '#ec4899', label: 'Pink' },
] as const;

export function AccentColorPicker() {
  const { t } = useTranslation();
  const accentColor = useSettingsStore((s) => s.accentColor);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.accentColor')}</h3>
      <div className="flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((preset) => {
          const isActive = accentColor === preset.color;
          return (
            <button
              key={preset.color || 'default'}
              onClick={() => setAccentColor(preset.color)}
              className={`relative w-8 h-8 rounded-full transition-transform duration-150 ${
                isActive ? 'scale-110 ring-2 ring-text-primary ring-offset-2 ring-offset-bg-card' : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: preset.color || 'var(--color-text-primary)',
              }}
              title={preset.label}
            >
              {isActive && (
                <svg className="absolute inset-0 m-auto w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={preset.color ? '#fff' : 'var(--color-bg-primary)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
