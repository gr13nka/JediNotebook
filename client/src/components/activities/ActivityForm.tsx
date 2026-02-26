import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { RotaryDial } from '../ui/RotaryDial';
import { ACTIVITY_COLORS } from '@shared/constants';
import { getNextColor } from '../../utils/colors';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';

interface ActivityFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, budgetMinutes: number, color: string) => void;
  usedColors?: string[];
  initialName?: string;
  initialBudget?: number;
  initialColor?: string;
  title?: string;
}

export function ActivityForm({
  open,
  onClose,
  onSubmit,
  usedColors = [],
  initialName = '',
  initialBudget = 60,
  initialColor,
  title,
}: ActivityFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [budget, setBudget] = useState(initialBudget);
  const [color, setColor] = useState(() => initialColor ?? getNextColor(usedColors));

  useEffect(() => {
    if (open) {
      setName(initialName);
      setBudget(initialBudget);
      setColor(initialColor ?? getNextColor(usedColors));
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), budget, color);
    if (!initialColor) {
      setName('');
      setBudget(60);
      setColor(getNextColor(usedColors));
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title ?? t('activityForm.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('activityForm.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('activityForm.namePlaceholder')}
          autoFocus
        />

        {/* Color picker */}
        <div>
          <span className="block text-sm text-text-secondary mb-2">{t('activityForm.color')}</span>
          <div className="flex gap-2 justify-center">
            {ACTIVITY_COLORS.map((c) => (
              <motion.button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full"
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? 'none' : NEU.raisedSm,
                  outline: color === c ? `2.5px solid ${c}` : 'none',
                  outlineOffset: color === c ? '3px' : '0',
                }}
                animate={{ scale: color === c ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>
        </div>

        {/* Rotary dial budget picker */}
        <div>
          <span className="block text-sm text-text-secondary mb-2">{t('activityForm.budget')}</span>
          <RotaryDial value={budget} onChange={setBudget} />
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('activityForm.cancel')}
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {t('activityForm.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
