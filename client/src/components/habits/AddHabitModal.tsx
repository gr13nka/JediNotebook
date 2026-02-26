import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { ACTIVITY_COLORS } from '@shared/constants';
import type { HabitType } from '@shared/types';

const HABIT_ICONS = ['brain', 'book', 'footprints', 'droplet', 'fire', 'heart', 'star', 'dumbbell'] as const;

const ICON_SVGS: Record<string, React.ReactNode> = {
  brain: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 3 1.5 5 3 6.5V22h8v-6.5c1.5-1.5 3-3.5 3-6.5a7 7 0 0 0-7-7z" />
      <path d="M9 22h6" /><path d="M10 2v2" /><path d="M14 2v2" />
    </svg>
  ),
  book: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  footprints: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16v-2.38C4 11.5 2.97 9.5 3 8c.03-1.5 1-3 2.5-3S8 5.5 8 8c0 1.5-.5 3.5-1 5.5L5 16" />
      <path d="M20 20v-2.38c0-2.12 1.03-4.12 1-5.62-.03-1.5-1-3-2.5-3S16 10.5 16 13c0 1.5.5 3.5 1 5.5l2 1.5" />
    </svg>
  ),
  droplet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  fire: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.33-2.16 1-3 .17.84.67 1.5 1.5 2.5" />
    </svg>
  ),
  heart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  star: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  dumbbell: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" /><path d="M6 6a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1V6z" />
      <path d="M3 8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1V8z" /><path d="M18 6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1V6z" />
      <path d="M21 8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1V8z" />
      <path d="M6 13a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v-5z" /><path d="M3 15a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1v-3z" />
      <path d="M18 13a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-5z" /><path d="M21 15a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1v-3z" />
    </svg>
  ),
};

interface AddHabitModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    type: HabitType;
    targetValue: number;
    unit: string;
    color: string;
    icon: string;
  }) => void;
}

export function AddHabitModal({ open, onClose, onAdd }: AddHabitModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('boolean');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [color, setColor] = useState<string>(ACTIVITY_COLORS[0]);
  const [icon, setIcon] = useState<string>('star');

  const reset = () => {
    setName('');
    setType('boolean');
    setTargetValue('');
    setUnit('');
    setColor(ACTIVITY_COLORS[0]);
    setIcon('star');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      type,
      targetValue: type === 'boolean' ? 1 : Number(targetValue) || 1,
      unit: type === 'boolean' ? '' : unit.trim(),
      color,
      icon,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('addHabit.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('addHabit.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('addHabit.namePlaceholder')}
          autoFocus
        />

        {/* Type toggle */}
        <div>
          <span className="block text-sm text-text-secondary mb-1">{t('addHabit.type')}</span>
          <div
            className="flex gap-1 rounded-lg p-1"
            style={{ boxShadow: NEU.pressed }}
          >
            {(['boolean', 'numeric'] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setType(tp)}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  type === tp ? 'text-text-primary' : 'text-text-secondary'
                }`}
                style={type === tp ? { boxShadow: NEU.raisedSm } : undefined}
              >
                {tp === 'boolean' ? t('addHabit.checkbox') : t('addHabit.numeric')}
              </button>
            ))}
          </div>
        </div>

        {/* Numeric fields */}
        {type === 'numeric' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label={t('addHabit.target')}
                type="number"
                min="1"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={t('addHabit.targetPlaceholder')}
              />
            </div>
            <div className="flex-1">
              <Input
                label={t('addHabit.unit')}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t('addHabit.unitPlaceholder')}
              />
            </div>
          </div>
        )}

        {/* Color picker */}
        <div>
          <span className="block text-sm text-text-secondary mb-1">{t('addHabit.color')}</span>
          <div className="flex gap-2 flex-wrap">
            {ACTIVITY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? NEU.pressed : NEU.raisedSm,
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Icon picker */}
        <div>
          <span className="block text-sm text-text-secondary mb-1">{t('addHabit.icon')}</span>
          <div className="flex gap-2 flex-wrap">
            {HABIT_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={{
                  boxShadow: icon === ic ? NEU.pressed : NEU.raisedSm,
                  color: icon === ic ? color : undefined,
                }}
              >
                {ICON_SVGS[ic]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {t('addHabit.cancel')}
          </Button>
          <Button type="submit" className="flex-1" disabled={!name.trim()}>
            {t('addHabit.add')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
