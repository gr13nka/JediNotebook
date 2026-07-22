import { useSettingsStore } from '../../stores/settingsStore';
import type { CustomThemeColors } from '@shared/types';

const FIELDS: { key: keyof CustomThemeColors; label: string }[] = [
  { key: 'bgPrimary', label: 'Background' },
  { key: 'bgCard', label: 'Card' },
  { key: 'bgElevated', label: 'Surface' },
  { key: 'textPrimary', label: 'Text' },
  { key: 'textSecondary', label: 'Secondary' },
  { key: 'textMuted', label: 'Muted' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentFg', label: 'Accent Text' },
  { key: 'green', label: 'Success' },
  { key: 'red', label: 'Error' },
  { key: 'barTrack', label: 'Bar Track' },
  { key: 'border', label: 'Border' },
];

export function CustomThemeEditor() {
  const customThemeColors = useSettingsStore(s => s.customThemeColors);
  const setCustomColors = useSettingsStore(s => s.setCustomColors);

  const handleChange = (key: keyof CustomThemeColors, value: string) => {
    setCustomColors({ ...customThemeColors, [key]: value });
  };

  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
      {FIELDS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 cursor-pointer">
          <input
            type="color"
            value={customThemeColors[key]}
            onChange={e => handleChange(key, e.target.value)}
            className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
          />
          <span className="text-xs text-text-secondary">{label}</span>
        </label>
      ))}
    </div>
  );
}
