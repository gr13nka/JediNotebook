import React, { useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../ui/Button';
import { exportToZip, importFromZip, importFromDirectory, importFromPath } from '../../vault/webExport';
import { isTauri, isMobileTauri } from '../../vault/platform';
import { useSettingsStore } from '../../stores/settingsStore';
import { FolderBrowserModal } from '../ui/FolderBrowserModal';

export function VaultSettings() {
  const { t } = useTranslation();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const update = useSettingsStore((s) => s.update);
  const vaultEnabled = useSettingsStore((s) => s.vaultEnabled);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);

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

        {isTauri() ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFolderBrowserOpen(true)}
            disabled={busy}
          >
            {t('vault.importFolder')}
          </Button>
        ) : (
          <>
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
          </>
        )}
      </div>

      <FolderBrowserModal
        open={folderBrowserOpen}
        onClose={() => setFolderBrowserOpen(false)}
        onSelect={async (path) => {
          setBusy(true);
          setStatus(t('vault.importing'));
          try {
            await importFromPath(path);
            setStatus(t('vault.importSuccess'));
          } catch (err) {
            setStatus(String(err));
          } finally {
            setBusy(false);
          }
        }}
      />

      {isTauri() && vaultEnabled && vaultPath && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-secondary mb-1">
            {t('vault.currentVault')}
          </p>
          <p className="text-xs text-text-muted truncate mb-2" title={vaultPath}>
            {vaultPath}
          </p>
          <div className="flex flex-wrap gap-2">
            {isMobileTauri() ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(vaultPath);
                    setStatus(t('vault.pathCopied'));
                  } catch {
                    setStatus(vaultPath);
                  }
                }}
              >
                {t('vault.copyPath')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
                    await revealItemInDir(vaultPath);
                  } catch (e) {
                    setStatus(String(e));
                  }
                }}
              >
                {t('vault.openFolder')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await update({ vaultSetupDone: false });
              }}
            >
              {t('vault.switchVault')}
            </Button>
          </div>
        </div>
      )}

      {isTauri() && !vaultEnabled && (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await update({ vaultSetupDone: false });
            }}
          >
            {t('vault.switchVault')}
          </Button>
        </div>
      )}

      {status && (
        <p className="text-xs text-text-muted mt-3">{status}</p>
      )}
    </div>
  );
}
