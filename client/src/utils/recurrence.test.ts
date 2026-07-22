import { describe, it, expect } from 'vitest';
import { getNextOccurrenceDate, shouldCreateRecurrence } from './recurrence';
import type { RecurrenceRule } from '@shared/types';

describe('getNextOccurrenceDate', () => {
  it('advances daily by the interval', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
    expect(getNextOccurrenceDate(rule, '2026-07-21')).toBe('2026-07-22');
  });

  it('advances daily by a multi-day interval', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 3 };
    expect(getNextOccurrenceDate(rule, '2026-07-21')).toBe('2026-07-24');
  });

  it('advances weekly by interval * 7 days', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 };
    expect(getNextOccurrenceDate(rule, '2026-07-21')).toBe('2026-07-28');
  });

  it('advances weekly by a multi-week interval', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 2 };
    expect(getNextOccurrenceDate(rule, '2026-07-21')).toBe('2026-08-04');
  });

  it(
    'BUG (pinned, not fixed): weekly `daysOfWeek` is stored on the rule but ' +
      'never consulted — the next date is always fromDate + interval*7 days, ' +
      'landing on the same weekday as fromDate regardless of which days were ' +
      'selected. RecurrenceEditor.tsx lets a user pick e.g. Mon/Wed/Fri, but ' +
      'this function cannot produce those dates.',
    () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] };
      // 2026-07-21 is a Tuesday; a Mon/Wed/Fri schedule should plausibly
      // produce Wednesday (2026-07-22) as the next occurrence. Instead it
      // ignores daysOfWeek entirely and just adds 7 days.
      expect(getNextOccurrenceDate(rule, '2026-07-21')).toBe('2026-07-28');
    },
  );

  it('advances monthly by the interval, keeping the day of month when it fits', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 };
    expect(getNextOccurrenceDate(rule, '2026-06-10')).toBe('2026-07-10');
  });

  it('advances monthly across a year boundary', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 };
    expect(getNextOccurrenceDate(rule, '2025-12-15')).toBe('2026-01-15');
  });

  it('advances monthly by a multi-month interval', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 2 };
    expect(getNextOccurrenceDate(rule, '2026-01-15')).toBe('2026-03-15');
  });

  it('clamps dayOfMonth to the target month length (e.g. 31 -> Feb 28)', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
    expect(getNextOccurrenceDate(rule, '2026-01-15')).toBe('2026-02-28');
  });

  it('clamps dayOfMonth to 29 in a leap-year February', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
    expect(getNextOccurrenceDate(rule, '2028-01-15')).toBe('2028-02-29');
  });

  it(
    'BUG (pinned, not fixed): monthly recurrence skips a month when ' +
      'fromDate falls on a day that overflows the immediately-following ' +
      'month. `date.setMonth(m+1)` on Jan 31 rolls over Feb entirely ' +
      '(Feb has 28/29 days) landing in March, *before* any dayOfMonth ' +
      'clamp runs. No dayOfMonth set: next date should conceptually be ' +
      'end-of-February but is March 3.',
    () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 };
      expect(getNextOccurrenceDate(rule, '2026-01-31')).toBe('2026-03-03');
    },
  );

  it(
    'BUG (pinned, not fixed): the same overflow corrupts the dayOfMonth ' +
      'clamp too — clamping is computed against the *already-overflowed* ' +
      'month (March), so "31st of next month" from Jan 31 resolves to ' +
      'March 31 instead of the intended Feb 28, silently skipping ' +
      'February\'s occurrence altogether.',
    () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
      expect(getNextOccurrenceDate(rule, '2026-01-31')).toBe('2026-03-31');
    },
  );
});

describe('shouldCreateRecurrence', () => {
  const daily: RecurrenceRule = { frequency: 'daily', interval: 1 };

  it('is true when there is no lastRecurredDate, regardless of rule or today', () => {
    expect(shouldCreateRecurrence(null, daily, '2026-07-21')).toBe(true);
  });

  it('is true when the next occurrence is due exactly today (inclusive boundary)', () => {
    // last recurred 2026-07-20, daily interval 1 -> next date 2026-07-21
    expect(shouldCreateRecurrence('2026-07-20', daily, '2026-07-21')).toBe(true);
  });

  it('is true when the next occurrence date is in the past (overdue)', () => {
    expect(shouldCreateRecurrence('2026-07-18', daily, '2026-07-21')).toBe(true);
  });

  it('is false when the next occurrence date is still in the future', () => {
    // last recurred today -> next date is tomorrow -> not due yet
    expect(shouldCreateRecurrence('2026-07-21', daily, '2026-07-21')).toBe(false);
  });

  it('respects weekly interval boundaries', () => {
    const weekly: RecurrenceRule = { frequency: 'weekly', interval: 1 };
    expect(shouldCreateRecurrence('2026-07-14', weekly, '2026-07-21')).toBe(true); // due today
    expect(shouldCreateRecurrence('2026-07-15', weekly, '2026-07-21')).toBe(false); // due tomorrow
  });

  it('respects monthly interval boundaries', () => {
    const monthly: RecurrenceRule = { frequency: 'monthly', interval: 1 };
    expect(shouldCreateRecurrence('2026-06-21', monthly, '2026-07-21')).toBe(true); // due today
    expect(shouldCreateRecurrence('2026-06-22', monthly, '2026-07-21')).toBe(false); // due tomorrow
  });
});
