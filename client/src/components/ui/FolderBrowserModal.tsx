import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';

interface FolderBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export function FolderBrowserModal({
  open,
  onClose,
  onSelect,
  initialPath = '/storage/emulated/0',
}: FolderBrowserModalProps) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualPath, setManualPath] = useState('');

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const raw = await readDir(path);
      const folders: DirEntry[] = raw
        .filter((e) => e.isDirectory && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, isDirectory: true }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setEntries(folders);
      setCurrentPath(path);
    } catch (e) {
      setError(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setShowManual(false);
      setManualPath('');
      loadDir(initialPath);
    }
  }, [open, initialPath, loadDir]);

  const navigateUp = () => {
    const parent = currentPath.replace(/\/[^/]+$/, '') || '/';
    if (parent !== currentPath) {
      loadDir(parent);
    }
  };

  const navigateInto = (name: string) => {
    const next = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    loadDir(next);
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  const handleManualGo = () => {
    const trimmed = manualPath.trim();
    if (trimmed) {
      loadDir(trimmed);
      setShowManual(false);
      setManualPath('');
    }
  };

  // Breadcrumb segments
  const segments = currentPath.split('/').filter(Boolean);

  const canGoUp = currentPath !== '/' && currentPath !== '/storage/emulated/0';

  return (
    <Modal open={open} onClose={onClose} title={t('vault.folderBrowserTitle')}>
      {/* Breadcrumb path */}
      <div
        className="flex flex-wrap items-center gap-1 px-3 py-2 rounded-xl mb-3 text-xs overflow-x-auto"
        style={{ boxShadow: NEU.pressed }}
      >
        <button
          onClick={() => loadDir('/')}
          className="text-accent hover:underline shrink-0"
        >
          /
        </button>
        {segments.map((seg, i) => {
          const path = '/' + segments.slice(0, i + 1).join('/');
          const isLast = i === segments.length - 1;
          return (
            <React.Fragment key={path}>
              <span className="text-text-muted">/</span>
              {isLast ? (
                <span className="text-text-primary font-medium">{seg}</span>
              ) : (
                <button
                  onClick={() => loadDir(path)}
                  className="text-accent hover:underline"
                >
                  {seg}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Directory listing */}
      <div
        className="rounded-xl border border-border overflow-hidden mb-3"
        style={{ boxShadow: NEU.pressed, maxHeight: '50vh', overflowY: 'auto' }}
      >
        {/* Navigate up */}
        {canGoUp && (
          <button
            onClick={navigateUp}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-elevated/50 transition-colors border-b border-border"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm text-text-secondary">{t('vault.folderBrowserUp')}</span>
          </button>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-red mb-2">{t('vault.folderBrowserError')}</p>
            <p className="text-xs text-text-muted break-all">{error}</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-text-muted">{t('vault.folderBrowserEmpty')}</p>
          </div>
        )}

        {!loading && !error && entries.map((entry) => (
          <button
            key={entry.name}
            onClick={() => navigateInto(entry.name)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-elevated/50 transition-colors border-b border-border last:border-b-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm text-text-primary truncate">{entry.name}</span>
          </button>
        ))}
      </div>

      {/* Manual path toggle */}
      {showManual ? (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder="/storage/emulated/0/..."
            className="flex-1 rounded-xl px-3 py-2 text-sm bg-bg-primary text-text-primary border border-border focus:border-accent focus:outline-none transition-colors"
            style={{ boxShadow: NEU.pressed }}
            onKeyDown={(e) => e.key === 'Enter' && handleManualGo()}
          />
          <button
            onClick={handleManualGo}
            disabled={!manualPath.trim()}
            className="rounded-xl px-4 py-2 text-sm font-medium text-accent-fg bg-accent disabled:opacity-50"
            style={{ boxShadow: NEU.raisedSm }}
          >
            Go
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowManual(true)}
          className="text-xs text-accent hover:underline mb-3 block"
        >
          {t('vault.folderBrowserManual')}
        </button>
      )}

      {/* Select button */}
      <button
        onClick={handleSelect}
        className="w-full rounded-xl px-4 py-3 font-medium text-accent-fg bg-accent transition-opacity"
        style={{ boxShadow: NEU.raisedSm }}
      >
        {t('vault.folderBrowserSelect')}
      </button>
    </Modal>
  );
}
