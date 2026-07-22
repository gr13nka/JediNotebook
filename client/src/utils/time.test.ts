import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDuration, getLogicalDate } from './time';

// vitest.config.ts pins TZ=UTC for this whole test run. getLogicalDate
// compares `reference.getHours()` (local) but serializes the result via
// `.toISOString()` (UTC) — those only agree when local time IS UTC. Running
// under any other host timezone can shift the returned date by an extra day
// for early-morning reference times (see the getLogicalDate describe block
// below and the test-run report for a concrete reproduction). Pinning TZ
// here keeps these tests deterministic and matches the boundary values
// documented in the refactor plan.

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
});
