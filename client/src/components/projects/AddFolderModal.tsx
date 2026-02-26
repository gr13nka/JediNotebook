import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useTranslation } from '../../i18n/useTranslation';
import { ACTIVITY_COLORS } from '@shared/constants';
import { NEU } from '../../utils/shadows';

interface AddFolderModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; color: string }) => void;
}

export function AddFolderModal({ open, onClose, onAdd }: AddFolderModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(ACTIVITY_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), color });
    setName('');
    setColor(ACTIVITY_COLORS[0]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('folders.newFolder')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('folders.namePlaceholder')}
          autoFocus
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none rounded-lg px-3 py-2"
          style={{ boxShadow: NEU.pressedSm }}
        />
        <div>
          <span className="text-xs text-text-muted mb-2 block">{t('folders.color')}</span>
          <div className="flex gap-2 flex-wrap">
            {ACTIVITY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? NEU.pressedSm : NEU.raisedSm,
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('folders.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!name.trim()}>
            {t('folders.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
