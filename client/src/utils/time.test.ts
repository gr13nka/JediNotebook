import { describe, it, expect, vi, afterEach } from 'vitest';
import { daysBetween, formatDuration, getLogicalDate } from './time';

// getLogicalDate builds its result from LOCAL date components throughout
// (both the dayStartHour comparison and the output string), so every case
// below is timezone-independent — no TZ pin needed in vitest.config.ts.
// The 'is timezone-independent' case near the end of the getLogicalDate
// block reproduces the bug this used to have (mixing a local-hour
// comparison with UTC serialization) to guard against regressing it.

describe('formatDuration', () => {
  it('clamps negative durations to zero', () => {
    expect(formatDuration(-100)).toBe('0:00');
  });

  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('floors fractional seconds', () => {
    expect(formatDuration(61.9)).toBe('1:01');
  });

  it('pads single-digit seconds under a minute', () => {
    expect(formatDuration(5)).toBe('0:05');
  });

  it('formats minutes:seconds under an hour', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3599)).toBe('59:59'); // just under the h:mm:ss switch
  });

  it('switches to h:mm:ss at exactly one hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });

  it('formats hours, minutes and seconds together', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('formats multi-digit hour counts without padding the hour', () => {
    expect(formatDuration(90061)).toBe('25:01:01');
  });
});

describe('getLogicalDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the previous calendar date when reference hour is before dayStartHour', () => {
    const reference = new Date(2026, 6, 21, 5, 59); // 05:59, dayStartHour 6
    expect(getLogicalDate(6, reference)).toBe('2026-07-20');
  });

  it('returns the same calendar date exactly at dayStartHour (boundary is inclusive)', () => {
    const reference = new Date(2026, 6, 21, 6, 0);
    expect(getLogicalDate(6, reference)).toBe('2026-07-21');
  });

  it('returns the same calendar date after dayStartHour', () => {
    const reference = new Date(2026, 6, 21, 6, 1);
    expect(getLogicalDate(6, reference)).toBe('2026-07-21');
  });

  it('never decrements when dayStartHour is 0 (every hour is >= 0)', () => {
    const reference = new Date(2026, 6, 21, 0, 0);
    expect(getLogicalDate(0, reference)).toBe('2026-07-21');
  });

  it('decrements correctly for a late dayStartHour like 6 at 05:00', () => {
    const reference = new Date(2026, 6, 21, 5, 0);
    expect(getLogicalDate(6, reference)).toBe('2026-07-20');
  });

  it('crosses a month boundary (non-leap Feb)', () => {
    // 2026 is not a leap year: Feb has 28 days.
    const reference = new Date(2026, 2, 1, 2, 0); // Mar 1, 02:00
    expect(getLogicalDate(6, reference)).toBe('2026-02-28');
  });

  it('crosses a year boundary', () => {
    const reference = new Date(2026, 0, 1, 1, 0); // Jan 1, 01:00
    expect(getLogicalDate(6, reference)).toBe('2025-12-31');
  });

  it('defaults reference to the current time when omitted (backward compatible signature)', () => {
    vi.useFakeTimers();
    const frozen = new Date(2026, 6, 21, 10, 0);
    vi.setSystemTime(frozen);
    expect(getLogicalDate(6)).toBe(getLogicalDate(6, frozen));
    expect(getLogicalDate(6)).toBe('2026-07-21');
  });

  it('daysBetween: positive when b is later', () => {
    expect(daysBetween('2026-07-20', '2026-07-21')).toBe(1);
    expect(daysBetween('2026-07-01', '2026-07-31')).toBe(30);
  });

  it('daysBetween: zero for the same day', () => {
    expect(daysBetween('2026-07-21', '2026-07-21')).toBe(0);
  });

  it('daysBetween: negative when b is earlier', () => {
    expect(daysBetween('2026-07-21', '2026-07-20')).toBe(-1);
  });

  it('daysBetween: crosses month and year boundaries exactly (UTC parse, DST-immune)', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1); // 2026 is not a leap year
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    // Spans the spring DST transition in most northern-hemisphere zones; a
    // local-time parse would make this a non-integer (23-hour day).
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('is timezone-independent: local hour comparison and output stay consistent east of UTC', () => {
    // Regression guard for the original bug: it compared local
    // `reference.getHours()` but serialized via `.toISOString()` (UTC).
    // Under UTC+3, 2026-01-01 01:00 local is still 2025-12-31 22:00 UTC —
    // the old implementation decremented the date correctly (01:00 < 6) but
    // then serialized the UTC instant, landing on 2025-12-30 instead of the
    // correct 2025-12-31.
    vi.stubEnv('TZ', 'Etc/GMT-3'); // POSIX sign is inverted: this IS UTC+3
    try {
      const reference = new Date(2026, 0, 1, 1, 0); // Jan 1, 01:00 local
      expect(reference.getTimezoneOffset()).toBe(-180); // sanity: UTC+3
      expect(getLogicalDate(6, reference)).toBe('2025-12-31');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
