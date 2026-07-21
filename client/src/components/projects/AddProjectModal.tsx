import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EmojiPicker } from '../ui/EmojiPicker';
import { useTranslation } from '../../i18n/useTranslation';
import { ACTIVITY_COLORS } from '@shared/constants';
import { NEU } from '../../utils/shadows';

interface AddProjectModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; color: string; icon?: string }) => void;
}

export function AddProjectModal({ open, onClose, onAdd }: AddProjectModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(ACTIVITY_COLORS[0]);
  const [icon, setIcon] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null);
  const iconBtnRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), color, icon: icon || undefined });
    setName('');
    setColor(ACTIVITY_COLORS[0]);
    setIcon('');
    onClose();
  };

  const openEmojiPicker = () => {
    if (iconBtnRef.current) {
      setEmojiAnchorRect(iconBtnRef.current.getBoundingClientRect());
    }
    setEmojiPickerOpen(true);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('projects.newTitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projects.namePlaceholder')}
          autoFocus
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none rounded-lg px-3 py-2"
          style={{ boxShadow: NEU.pressedSm }}
        />
        <div>
          <span className="text-xs text-text-muted mb-2 block">{t('projects.color')}</span>
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
        {/* Icon picker */}
        <div>
          <span className="text-xs text-text-muted mb-2 block">{t('projects.addIcon')}</span>
          <div className="flex items-center gap-2">
            <button
              ref={iconBtnRef}
              type="button"
              onClick={openEmojiPicker}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors hover:bg-bg-elevated"
              style={{ boxShadow: NEU.raisedSm }}
            >
              {icon || '+'}
            </button>
            {icon && (
              <button
                type="button"
                onClick={() => setIcon('')}
                className="text-[11px] text-text-muted hover:text-red transition-colors"
              >
                {t('projects.removeIcon')}
              </button>
            )}
          </div>
          <EmojiPicker
            open={emojiPickerOpen}
            onClose={() => setEmojiPickerOpen(false)}
            onSelect={(emoji) => setIcon(emoji)}
            onRemove={icon ? () => setIcon('') : undefined}
            anchorRect={emojiAnchorRect}
          />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('projects.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!name.trim()}>
            {t('projects.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
