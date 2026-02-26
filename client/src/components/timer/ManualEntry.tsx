import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import type { Activity } from '@shared/types';

interface ManualEntryProps {
  open: boolean;
  onClose: () => void;
  activities: Activity[];
  onSubmit: (activityId: string, durationSeconds: number) => void;
}

export function ManualEntry({ open, onClose, activities, onSubmit }: ManualEntryProps) {
  const { t } = useTranslation();
  const [activityId, setActivityId] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityId) return;
    const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60;
    if (totalSeconds <= 0) return;
    onSubmit(activityId, totalSeconds);
    setActivityId('');
    setHours('0');
    setMinutes('30');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('manualEntry.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className="block text-sm text-text-secondary mb-1">{t('manualEntry.activity')}</span>
          <select
            className="w-full rounded-xl bg-bg-card px-3 py-2 text-text-primary focus:outline-none"
            style={{
              border: 'none',
              boxShadow: NEU.pressed,
            }}
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
          >
            <option value="">{t('manualEntry.selectPlaceholder')}</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <Input
            label={t('manualEntry.hours')}
            type="number"
            min="0"
            max="24"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <Input
            label={t('manualEntry.minutes')}
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('manualEntry.cancel')}
          </Button>
          <Button type="submit" disabled={!activityId}>
            {t('manualEntry.add')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
