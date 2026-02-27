import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';

export function DayBoundarySettings() {
  const { t } = useTranslation();
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);
  const dayEndHour = useSettingsStore((s) => s.dayEndHour);
  const update = useSettingsStore((s) => s.update);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.dayBoundaries')}</h3>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="block text-sm text-text-primary mb-1">{t('settings.dayStarts')}</span>
          <select
            className="w-full rounded-xl bg-bg-card px-3 py-2 text-text-primary border border-border focus:outline-none focus:border-accent"
            style={{
              boxShadow: NEU.pressed,
            }}
            value={dayStartHour}
            onChange={(e) => update({ dayStartHour: parseInt(e.target.value) })}
          >
            {hours.map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm text-text-primary mb-1">{t('settings.dayEnds')}</span>
          <select
            className="w-full rounded-xl bg-bg-card px-3 py-2 text-text-primary border border-border focus:outline-none focus:border-accent"
            style={{
              boxShadow: NEU.pressed,
            }}
            value={dayEndHour}
            onChange={(e) => update({ dayEndHour: parseInt(e.target.value) })}
          >
            {hours.map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
