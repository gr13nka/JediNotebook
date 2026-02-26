import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { useTranslation } from '../../i18n/useTranslation';
import type { PomodoroPreset } from '@shared/types';

interface PresetFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    workMinutes: number;
    breakMinutes: number;
    longBreakMinutes: number;
    sessionsBeforeLongBreak: number;
    autoStartBreaks: boolean;
    autoStartWork: boolean;
  }) => void;
  onDelete?: () => void;
  preset?: PomodoroPreset | null;
}

export function PresetFormModal({
  open,
  onClose,
  onSave,
  onDelete,
  preset,
}: PresetFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(4);
  const [autoStartBreaks, setAutoStartBreaks] = useState(true);
  const [autoStartWork, setAutoStartWork] = useState(false);

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setWorkMinutes(preset.workMinutes);
      setBreakMinutes(preset.breakMinutes);
      setLongBreakMinutes(preset.longBreakMinutes);
      setSessionsBeforeLongBreak(preset.sessionsBeforeLongBreak);
      setAutoStartBreaks(preset.autoStartBreaks);
      setAutoStartWork(preset.autoStartWork);
    } else {
      setName('');
      setWorkMinutes(25);
      setBreakMinutes(5);
      setLongBreakMinutes(15);
      setSessionsBeforeLongBreak(4);
      setAutoStartBreaks(true);
      setAutoStartWork(false);
    }
  }, [preset, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      workMinutes: Math.max(1, workMinutes),
      breakMinutes: Math.max(1, breakMinutes),
      longBreakMinutes: Math.max(1, longBreakMinutes),
      sessionsBeforeLongBreak: Math.max(1, sessionsBeforeLongBreak),
      autoStartBreaks,
      autoStartWork,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={preset ? t('preset.editTitle') : t('preset.newTitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('preset.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('preset.namePlaceholder')}
          required
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label={t('preset.workMin')}
            type="number"
            min={1}
            max={120}
            value={workMinutes}
            onChange={(e) => setWorkMinutes(Number(e.target.value))}
          />
          <Input
            label={t('preset.breakMin')}
            type="number"
            min={1}
            max={60}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
          />
          <Input
            label={t('preset.longBreak')}
            type="number"
            min={1}
            max={60}
            value={longBreakMinutes}
            onChange={(e) => setLongBreakMinutes(Number(e.target.value))}
          />
        </div>
        <Input
          label={t('preset.sessions')}
          type="number"
          min={1}
          max={10}
          value={sessionsBeforeLongBreak}
          onChange={(e) => setSessionsBeforeLongBreak(Number(e.target.value))}
        />
        <div className="flex flex-col gap-3">
          <Toggle
            checked={autoStartBreaks}
            onChange={setAutoStartBreaks}
            label={t('preset.autoBreaks')}
          />
          <Toggle
            checked={autoStartWork}
            onChange={setAutoStartWork}
            label={t('preset.autoWork')}
          />
        </div>
        <div className="flex gap-2 justify-end mt-2">
          {onDelete && preset && !preset.isDefault && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              {t('preset.delete')}
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('preset.cancel')}
          </Button>
          <Button type="submit">{t('preset.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
