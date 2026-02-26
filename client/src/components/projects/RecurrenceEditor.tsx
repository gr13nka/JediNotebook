import React from 'react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import type { RecurrenceRule, RecurrenceFrequency } from '@shared/types';

interface RecurrenceEditorProps {
  rule: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
}

const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function RecurrenceEditor({ rule, onChange }: RecurrenceEditorProps) {
  const { t } = useTranslation();

  const handleToggle = () => {
    if (rule) {
      onChange(null);
    } else {
      onChange({ frequency: 'daily', interval: 1 });
    }
  };

  const handleFrequency = (frequency: RecurrenceFrequency) => {
    if (!rule) return;
    const updated: RecurrenceRule = { frequency, interval: rule.interval };
    if (frequency === 'weekly') {
      updated.daysOfWeek = rule.daysOfWeek ?? [];
    }
    if (frequency === 'monthly') {
      updated.dayOfMonth = rule.dayOfMonth ?? 1;
    }
    onChange(updated);
  };

  const handleInterval = (val: string) => {
    if (!rule) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return;
    onChange({ ...rule, interval: num });
  };

  const handleDayToggle = (day: number) => {
    if (!rule) return;
    const days = rule.daysOfWeek ? [...rule.daysOfWeek] : [];
    const idx = days.indexOf(day);
    if (idx >= 0) {
      days.splice(idx, 1);
    } else {
      days.push(day);
      days.sort();
    }
    onChange({ ...rule, daysOfWeek: days });
  };

  const handleDayOfMonth = (val: string) => {
    if (!rule) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 31) return;
    onChange({ ...rule, dayOfMonth: num });
  };

  const unitLabel = rule
    ? rule.frequency === 'daily' ? t('recurrence.days')
    : rule.frequency === 'weekly' ? t('recurrence.weeks')
    : t('recurrence.months')
    : '';

  return (
    <div className="flex flex-col gap-2 py-2 pl-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">{t('recurrence.repeat')}</span>
        <button
          onClick={handleToggle}
          className="px-2 py-0.5 rounded text-xs font-medium text-text-primary transition-all"
          style={{ boxShadow: rule ? NEU.pressedSm : NEU.raisedSm }}
        >
          {rule ? t('recurrence.repeat') : t('recurrence.off')}
        </button>
      </div>

      {rule && (
        <>
          <div className="flex items-center gap-1.5">
            {FREQUENCIES.map((freq) => (
              <button
                key={freq}
                onClick={() => handleFrequency(freq)}
                className="px-2 py-0.5 rounded text-xs font-medium text-text-primary transition-all"
                style={{ boxShadow: rule.frequency === freq ? NEU.pressedSm : NEU.raisedSm }}
              >
                {t(`recurrence.${freq}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">{t('recurrence.every')}</span>
            <input
              type="number"
              min={1}
              value={rule.interval}
              onChange={(e) => handleInterval(e.target.value)}
              className="w-12 bg-transparent text-xs text-text-primary text-center rounded px-1 py-0.5 focus:outline-none"
              style={{ boxShadow: NEU.pressedSm }}
            />
            <span className="text-xs text-text-muted">{unitLabel}</span>
          </div>

          {rule.frequency === 'weekly' && (
            <div className="flex items-center gap-1">
              {DAY_LABELS.map((label, i) => {
                const active = rule.daysOfWeek?.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => handleDayToggle(i)}
                    className="w-6 h-6 rounded text-[10px] font-medium text-text-primary transition-all"
                    style={{ boxShadow: active ? NEU.pressedSm : NEU.raisedSm }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {rule.frequency === 'monthly' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Day</span>
              <input
                type="number"
                min={1}
                max={31}
                value={rule.dayOfMonth ?? 1}
                onChange={(e) => handleDayOfMonth(e.target.value)}
                className="w-12 bg-transparent text-xs text-text-primary text-center rounded px-1 py-0.5 focus:outline-none"
                style={{ boxShadow: NEU.pressedSm }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
