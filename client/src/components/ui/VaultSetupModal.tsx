import React, { useState } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';

export function VaultSetupModal() {
  const { t } = useTranslation();
  const update = useSettingsStore((s) => s.update);
  const [loading, setLoading] = useState(false);

  const handleSelectFolder = async () => {
    setLoading(true);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        title: t('vault.setupSelect'),
      });
      if (selected) {
        await update({
          vaultEnabled: true,
          vaultPath: selected,
          vaultSetupDone: true,
        });
      }
    } catch {
      // User cancelled or dialog error — do nothing
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await update({ vaultSetupDone: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary">
      <motion.div
        className="w-full max-w-sm rounded-2xl bg-bg-card p-8 text-center"
        style={{ boxShadow: NEU.modal }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="text-4xl mb-4">⏱</div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          {t('vault.setupTitle')}
        </h1>
        <p className="text-sm text-text-secondary mb-8 leading-relaxed">
          {t('vault.setupDescription')}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleSelectFolder}
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 font-medium text-accent-fg bg-accent transition-opacity disabled:opacity-50"
            style={{ boxShadow: NEU.raisedSm }}
          >
            {loading ? '...' : t('vault.setupSelect')}
          </button>
          <button
            onClick={handleSkip}
            className="w-full rounded-xl px-4 py-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            {t('vault.setupSkip')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
