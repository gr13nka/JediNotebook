import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';

export function TimezoneSettings() {
  const { t } = useTranslation();
  const timezone = useSettingsStore((s) => s.timezone);
  const update = useSettingsStore((s) => s.update);

  const timezones = useMemo((): string[] => {
    try {
      return (Intl as any).supportedValuesOf('timeZone');
    } catch {
      // Fallback for older browsers
      return [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney',
      ];
    }
  }, []);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.tz')}</h3>
      <select
        className="w-full rounded-xl bg-bg-card px-3 py-2 text-text-primary focus:outline-none"
        style={{
          border: 'none',
          boxShadow: NEU.pressed,
        }}
        value={timezone}
        onChange={(e) => update({ timezone: e.target.value })}
      >
        {timezones.map((tz) => (
          <option key={tz} value={tz}>{tz}</option>
        ))}
      </select>
    </div>
  );
}
