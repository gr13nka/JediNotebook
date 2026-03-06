import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EmojiPicker } from '../ui/EmojiPicker';
import { useTranslation } from '../../i18n/useTranslation';
import { ACTIVITY_COLORS } from '@shared/constants';
import { NEU } from '../../utils/shadows';

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  color: string;
  icon: string;
  onSave: (data: { name: string; color: string; icon: string }) => void;
}

export function EditProjectModal({ open, onClose, name, color, icon, onSave }: EditProjectModalProps) {
  const { t } = useTranslation();
  const [localName, setLocalName] = useState(name);
  const [localColor, setLocalColor] = useState(color);
  const [localIcon, setLocalIcon] = useState(icon);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null);
  const iconBtnRef = useRef<HTMLButtonElement>(null);

  // Sync local state when modal opens with new values
  useEffect(() => {
    if (open) {
      setLocalName(name);
      setLocalColor(color);
      setLocalIcon(icon);
    }
  }, [open, name, color, icon]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localName.trim()) return;
    onSave({ name: localName.trim(), color: localColor, icon: localIcon });
    onClose();
  };

  const openEmojiPicker = () => {
    if (iconBtnRef.current) {
      setEmojiAnchorRect(iconBtnRef.current.getBoundingClientRect());
    }
    setEmojiPickerOpen(true);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('projects.editProject')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
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
                onClick={() => setLocalColor(c)}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  boxShadow: localColor === c ? NEU.pressedSm : NEU.raisedSm,
                  transform: localColor === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
        {/* Icon picker */}
        <div>
          <span className="text-xs text-text-muted mb-2 block">{t('addHabit.icon')}</span>
          <div className="flex items-center gap-2">
            <button
              ref={iconBtnRef}
              type="button"
              onClick={openEmojiPicker}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors hover:bg-bg-elevated"
              style={{ boxShadow: NEU.raisedSm }}
            >
              {localIcon || '+'}
            </button>
            {localIcon && (
              <button
                type="button"
                onClick={() => setLocalIcon('')}
                className="text-[11px] text-text-muted hover:text-red transition-colors"
              >
                {t('projects.removeIcon')}
              </button>
            )}
          </div>
          <EmojiPicker
            open={emojiPickerOpen}
            onClose={() => setEmojiPickerOpen(false)}
            onSelect={(emoji) => setLocalIcon(emoji)}
            onRemove={localIcon ? () => setLocalIcon('') : undefined}
            anchorRect={emojiAnchorRect}
          />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('projects.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!localName.trim()}>
            {t('projects.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
