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

  describe('weekly with daysOfWeek', () => {
    // 2026-07-21 is a Tuesday. Mon/Wed/Fri = [1, 3, 5].
    const monWedFri: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] };

    it('advances to the next selected weekday within the same week', () => {
      expect(getNextOccurrenceDate(monWedFri, '2026-07-21')).toBe('2026-07-22'); // Tue -> Wed
    });

    it('chains through multiple selected days within the same week', () => {
      expect(getNextOccurrenceDate(monWedFri, '2026-07-22')).toBe('2026-07-24'); // Wed -> Fri
    });

    it('wraps to next week\'s first selected day once past the last selected day (interval 1)', () => {
      // Fri (the last selected day) -> Monday, still the following week, no gap.
      expect(getNextOccurrenceDate(monWedFri, '2026-07-24')).toBe('2026-07-27');
    });

    it('skips a full week before resuming when interval is 2', () => {
      const rule: RecurrenceRule = { ...monWedFri, interval: 2 };
      // Fri 07-24 wraps: interval 1 would resume Mon 07-27, but interval 2
      // skips that whole Mon/Wed/Fri week and resumes Mon 08-03.
      expect(getNextOccurrenceDate(rule, '2026-07-24')).toBe('2026-08-03');
    });

    it('treats Sunday (0) as a valid selected day when wrapping', () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [0, 3] }; // Sun/Wed
      // Thu (past both selected days that week) wraps to Sunday.
      expect(getNextOccurrenceDate(rule, '2026-07-23')).toBe('2026-07-26');
    });

    it('is independent of the stored order of daysOfWeek', () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [5, 1, 3] };
      expect(getNextOccurrenceDate(rule, '2026-07-21')).toBe('2026-07-22');
    });
  });

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
    'does not skip a month when fromDate falls on a day that overflows ' +
      'the immediately-following month (no dayOfMonth set: falls back to ' +
      'fromDate\'s own day-of-month, clamped)',
    () => {
      // Jan 31 + 1 month: February doesn't have a 31st, so the day clamps
      // to Feb's actual length (28, 2026 isn't a leap year) instead of
      // overflowing into March.
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 };
      expect(getNextOccurrenceDate(rule, '2026-01-31')).toBe('2026-02-28');
    },
  );

  it(
    'clamps an explicit dayOfMonth against the correct target month, not ' +
      'an already-overflowed one',
    () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
      expect(getNextOccurrenceDate(rule, '2026-01-31')).toBe('2026-02-28');
    },
  );

  it('does not clamp when the interval skips past the short month entirely', () => {
    // Jan 31 + 2 months = March, which does have a 31st — no clamping needed.
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 2, dayOfMonth: 31 };
    expect(getNextOccurrenceDate(rule, '2026-01-31')).toBe('2026-03-31');
  });
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
