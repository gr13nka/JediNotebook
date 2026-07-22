import type { RecurrenceRule } from '@shared/types';

/**
 * Computes the next occurrence date (YYYY-MM-DD) after `fromDate`, per `rule`.
 *
 * All arithmetic runs in UTC (matching how `new Date('YYYY-MM-DD')` parses —
 * as UTC midnight) rather than local time. `fromDate`/the result are plain
 * calendar dates, not timestamps, so they must not drift with the host's
 * timezone or DST — mixing UTC parsing with local getters/setters (the
 * previous implementation) reads the wrong month/weekday near local
 * midnight in non-UTC zones.
 *
 * - `daily`: fromDate + interval days.
 * - `weekly`, no `daysOfWeek`: fromDate + interval*7 days (same weekday).
 * - `weekly`, `daysOfWeek` set: the next SELECTED weekday strictly after
 *   fromDate, within the same week (0=Sun..6=Sat, matching `Date#getDay`).
 *   Once fromDate is on or after the week's last selected day (no selected
 *   day remains later that week), jump to the first selected day of the
 *   week that starts `interval` weeks later. So a Mon/Wed/Fri schedule with
 *   interval 1 fires every week; with interval 2 it fires for one week,
 *   then skips the next week entirely before resuming.
 * - `monthly`: same day-of-month, `interval` months later — computed by
 *   adding `interval` to the (year, month) pair directly, never via
 *   `Date#setMonth` (which overflows into a later month when the source
 *   day-of-month doesn't exist in the immediately-following month, e.g.
 *   Jan 31 + 1 month lands in March, silently skipping February). The day
 *   is `dayOfMonth` if set, else fromDate's day-of-month, clamped to
 *   however many days the target month actually has.
 */
export function getNextOccurrenceDate(rule: RecurrenceRule, fromDate: string): string {
  const date = new Date(fromDate);
  switch (rule.frequency) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + rule.interval);
      break;
    case 'weekly': {
      const days = rule.daysOfWeek;
      if (days && days.length > 0) {
        const sorted = [...days].sort((a, b) => a - b);
        const fromDay = date.getUTCDay();
        const next = sorted.find((d) => d > fromDay);
        if (next !== undefined) {
          date.setUTCDate(date.getUTCDate() + (next - fromDay));
        } else {
          const firstDay = sorted[0];
          const daysToNextWeekStart = 7 - fromDay + firstDay;
          date.setUTCDate(date.getUTCDate() + daysToNextWeekStart + (rule.interval - 1) * 7);
        }
      } else {
        date.setUTCDate(date.getUTCDate() + rule.interval * 7);
      }
      break;
    }
    case 'monthly': {
      const fromDay = date.getUTCDate();
      const totalMonths = date.getUTCMonth() + rule.interval;
      const targetYear = date.getUTCFullYear() + Math.floor(totalMonths / 12);
      const targetMonth = ((totalMonths % 12) + 12) % 12;
      const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      const day = Math.min(rule.dayOfMonth ?? fromDay, daysInTargetMonth);
      date.setTime(Date.UTC(targetYear, targetMonth, day));
      break;
    }
  }
  return date.toISOString().slice(0, 10);
}

export function shouldCreateRecurrence(lastRecurredDate: string | null, rule: RecurrenceRule, today: string): boolean {
  if (!lastRecurredDate) return true;
  const nextDate = getNextOccurrenceDate(rule, lastRecurredDate);
  return nextDate <= today;
}
