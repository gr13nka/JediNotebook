import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { isAndroidTauri } from '../../vault/platform';

function getVaultDisplayName(path: string): string {
  const name = path.split('/').pop() || path.split('\\').pop() || 'vault';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Android-specific flow: permission check + path input */
function AndroidVaultSetup({
  onOpenVault,
  loading,
  error,
}: {
  onOpenVault: (path: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [vaultPath, setVaultPath] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);

  const checkPermission = useCallback(async () => {
    try {
      const { checkStoragePermission } = await import('../../vault/androidStorage');
      const granted = await checkStoragePermission();
      setPermissionGranted(granted);
    } catch {
      // If plugin not available, assume granted (older Android)
      setPermissionGranted(true);
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Re-check permission when user returns from Settings
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        checkPermission();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [checkPermission]);

  // Load default path once permission is granted
  useEffect(() => {
    if (permissionGranted && !vaultPath) {
      import('../../vault/androidStorage').then(({ getDefaultVaultPath }) => {
        getDefaultVaultPath().then(setVaultPath).catch(() => {
          setVaultPath('/storage/emulated/0/Documents/WebTimer');
        });
      });
    }
  }, [permissionGranted, vaultPath]);

  const handleRequestPermission = async () => {
    try {
      const { requestStoragePermission } = await import('../../vault/androidStorage');
      await requestStoragePermission();
    } catch {
      // Intent may fail on some devices
    }
  };

  const handleOpenVault = () => {
    const trimmed = vaultPath.trim();
    if (!trimmed) {
      setPathError(t('vault.androidPathError'));
      return;
    }
    setPathError(null);
    onOpenVault(trimmed);
  };

  const handleUseDefault = async () => {
    try {
      const { getDefaultVaultPath } = await import('../../vault/androidStorage');
      const defaultPath = await getDefaultVaultPath();
      setVaultPath(defaultPath);
    } catch {
      setVaultPath('/storage/emulated/0/Documents/WebTimer');
    }
  };

  // Loading state — checking permission
  if (permissionGranted === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Step 1: Permission not granted
  if (!permissionGranted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-xl bg-bg-elevated border border-border">
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            {t('vault.androidPermissionTitle')}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            {t('vault.androidPermissionDesc')}
          </p>
        </div>
        <button
          onClick={handleRequestPermission}
          className="w-full rounded-xl px-4 py-3 font-medium text-accent-fg bg-accent transition-opacity"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('vault.androidGrantPermission')}
        </button>
      </div>
    );
  }

  // Step 2: Permission granted — show path input
  return (
    <div className="flex flex-col gap-3">
      {(error || pathError) && (
        <div className="p-3 rounded-xl bg-red/10 text-red text-xs">
          {error || pathError}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          {t('vault.androidPathLabel')}
        </label>
        <input
          type="text"
          value={vaultPath}
          onChange={(e) => setVaultPath(e.target.value)}
          placeholder={t('vault.androidPathHint')}
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-bg-primary text-text-primary border border-border focus:border-accent focus:outline-none transition-colors"
          style={{ boxShadow: NEU.pressed }}
        />
        <button
          onClick={handleUseDefault}
          className="mt-1.5 text-xs text-accent hover:underline"
        >
          {t('vault.androidUseDefault')}
        </button>
      </div>
      <button
        onClick={handleOpenVault}
        disabled={loading || !vaultPath.trim()}
        className="w-full rounded-xl px-4 py-3 font-medium text-accent-fg bg-accent transition-opacity disabled:opacity-50"
        style={{ boxShadow: NEU.raisedSm }}
      >
        {t('vault.openExisting')}
      </button>
    </div>
  );
}

export function VaultSetupModal() {
  const { t } = useTranslation();
  const update = useSettingsStore((s) => s.update);
  const addRecentVault = useSettingsStore((s) => s.addRecentVault);
  const recentVaults = useSettingsStore((s) => s.recentVaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAndroid = isAndroidTauri();

  const openVault = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const { useVaultStore } = await import('../../vault/vaultStore');
      await useVaultStore.getState().switchVault(path);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        title: t('vault.createNew'),
      });
      if (selected) {
        await openVault(selected);
      }
    } catch {
      // User cancelled
    }
  };

  const handleOpenExisting = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        title: t('vault.openExisting'),
      });
      if (selected) {
        await openVault(selected);
      }
    } catch {
      // User cancelled
    }
  };

  const handleSkip = async () => {
    await update({ vaultSetupDone: true });
  };

  const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const filtered = recentVaults.filter((v) => v.path !== path);
    await update({ recentVaults: filtered });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary">
      <AnimatePresence>
        {loading && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-primary/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-secondary">{t('vault.opening')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="w-full max-w-md rounded-2xl bg-bg-card p-8"
        style={{ boxShadow: NEU.modal }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">&#x23F1;</div>
          <h1 className="text-xl font-semibold text-text-primary mb-1">
            {t('vault.pickerTitle')}
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            {recentVaults.length > 0
              ? t('vault.pickerSubtitle')
              : t('vault.emptyVaultHint')}
          </p>
        </div>

        {!isAndroid && error && (
          <div className="mb-4 p-3 rounded-xl bg-red/10 text-red text-xs">
            {error}
          </div>
        )}

        {recentVaults.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              {t('vault.recentVaults')}
            </p>
            <div
              className="rounded-xl overflow-hidden border border-border"
              style={{ boxShadow: NEU.pressed }}
            >
              {recentVaults.map((vault, i) => (
                <motion.button
                  key={vault.path}
                  onClick={() => openVault(vault.path)}
                  disabled={loading}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg-elevated/50 transition-colors disabled:opacity-50 ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <div className="shrink-0 mt-0.5 text-lg text-accent">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {getVaultDisplayName(vault.path)}
                    </p>
                    <p className="text-xs text-text-muted truncate" title={vault.path}>
                      {vault.path}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {t('vault.lastOpened')} {formatRelativeTime(vault.lastOpened)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRecent(e, vault.path)}
                    className="shrink-0 mt-1 p-1 text-text-muted hover:text-red transition-colors rounded"
                    title={t('vault.removeRecent')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {isAndroid ? (
          <AndroidVaultSetup
            onOpenVault={openVault}
            loading={loading}
            error={error}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCreateNew}
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 font-medium text-accent-fg bg-accent transition-opacity disabled:opacity-50"
              style={{ boxShadow: NEU.raisedSm }}
            >
              {t('vault.createNew')}
            </button>
            <button
              onClick={handleOpenExisting}
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 font-medium text-text-primary bg-bg-elevated transition-opacity disabled:opacity-50"
              style={{ boxShadow: NEU.raisedSm }}
            >
              {t('vault.openExisting')}
            </button>
          </div>
        )}

        <button
          onClick={handleSkip}
          disabled={loading}
          className="w-full rounded-xl px-4 py-3 text-sm text-text-muted hover:text-text-secondary transition-colors mt-3"
        >
          {t('vault.setupSkip')}
        </button>
      </motion.div>
    </div>
  );
}
