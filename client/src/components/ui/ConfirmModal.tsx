import { Modal } from './Modal';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export function ConfirmModal({ open, onClose, onConfirm, title, message }: ConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-secondary mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm text-text-secondary transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="px-4 py-2 rounded-xl text-sm text-red font-medium transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('common.delete')}
        </button>
      </div>
    </Modal>
  );
}
