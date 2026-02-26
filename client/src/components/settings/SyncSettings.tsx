import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { syncNow } from '../../sync/syncEngine';

export function SyncSettings() {
  const { t } = useTranslation();
  const syncEnabled = useSettingsStore((s) => s.syncEnabled);
  const syncServerUrl = useSettingsStore((s) => s.syncServerUrl);
  const syncApiKey = useSettingsStore((s) => s.syncApiKey);
  const update = useSettingsStore((s) => s.update);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.sync')}</h3>
      <div className="flex flex-col gap-4">
        <Toggle
          checked={syncEnabled}
          onChange={(checked) => update({ syncEnabled: checked })}
          label={t('settings.enableSync')}
        />
        {syncEnabled && (
          <>
            <Input
              label={t('settings.serverUrl')}
              value={syncServerUrl}
              onChange={(e) => update({ syncServerUrl: e.target.value })}
              placeholder={t('settings.serverUrlPlaceholder')}
            />
            <Input
              label={t('settings.apiKey')}
              type="password"
              value={syncApiKey}
              onChange={(e) => update({ syncApiKey: e.target.value })}
              placeholder={t('settings.apiKeyPlaceholder')}
            />
            <Button
              variant="secondary"
              onClick={() => syncNow()}
              disabled={!syncServerUrl}
            >
              {t('settings.syncNow')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
