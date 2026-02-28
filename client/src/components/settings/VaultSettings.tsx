import React, { useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../ui/Button';
import { exportToZip, importFromZip, importFromDirectory } from '../../vault/webExport';

export function VaultSettings() {
  const { t } = useTranslation();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    setStatus(t('vault.exporting'));
    try {
      await exportToZip();
      setStatus(t('vault.exportSuccess'));
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(t('vault.importing'));
    try {
      await importFromZip(file);
      setStatus(t('vault.importSuccess'));
    } catch (err) {
      setStatus(t('vault.importError'));
    } finally {
      setBusy(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const handleImportFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatus(t('vault.importing'));
    try {
      await importFromDirectory(files);
      setStatus(t('vault.importSuccess'));
    } catch (err) {
      setStatus(t('vault.importError'));
    } finally {
      setBusy(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-2">{t('settings.vault')}</h3>
      <p className="text-xs text-text-muted mb-4">{t('vault.description')}</p>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={busy}>
          {t('vault.exportZip')}
        </Button>

        <Button variant="secondary" size="sm" onClick={() => zipInputRef.current?.click()} disabled={busy}>
          {t('vault.importZip')}
        </Button>
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleImportZip}
        />

        <Button variant="secondary" size="sm" onClick={() => folderInputRef.current?.click()} disabled={busy}>
          {t('vault.importFolder')}
        </Button>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleImportFolder}
        />
      </div>

      {status && (
        <p className="text-xs text-text-muted mt-3">{status}</p>
      )}
    </div>
  );
}
