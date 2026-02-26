import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useTranslation } from '../../i18n/useTranslation';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message }: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-text-secondary mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>
          {t('common.delete')}
        </Button>
      </div>
    </Modal>
  );
}
