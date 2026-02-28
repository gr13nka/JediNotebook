import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';

interface ProcrastinationConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ProcrastinationConfirmModal({ open, onClose, onConfirm }: ProcrastinationConfirmModalProps) {
  const [countdown, setCountdown] = useState(5);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) {
      setCountdown(5);
      return;
    }
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [open, countdown]);

  const handleConfirm = useCallback(() => {
    if (countdown > 0) return;
    onConfirm();
  }, [countdown, onConfirm]);

  return (
    <Modal open={open} onClose={onClose} title={t('procrastination.title')}>
      <p className="text-sm text-text-secondary mb-6">
        Это точно первый шаг который нужно сделать чтобы завершить задачу?
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-xl text-text-secondary transition-all"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={countdown > 0}
          className="px-4 py-2 text-sm rounded-xl text-accent-fg transition-all"
          style={{
            boxShadow: countdown > 0 ? NEU.pressedSm : NEU.raisedSm,
            backgroundColor: 'var(--color-accent)',
            opacity: countdown > 0 ? 0.4 : 1,
          }}
        >
          {countdown > 0 ? `${t('common.save')} (${countdown}s)` : t('common.save')}
        </button>
      </div>
    </Modal>
  );
}
