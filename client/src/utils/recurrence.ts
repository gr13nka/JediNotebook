import type { RecurrenceRule } from '@shared/types';

export function getNextOccurrenceDate(rule: RecurrenceRule, fromDate: string): string {
  const date = new Date(fromDate);
  switch (rule.frequency) {
    case 'daily':
      date.setDate(date.getDate() + rule.interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + rule.interval * 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + rule.interval);
      if (rule.dayOfMonth) {
        date.setDate(Math.min(rule.dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      }
      break;
  }
  return date.toISOString().slice(0, 10);
}

export function shouldCreateRecurrence(lastRecurredDate: string | null, rule: RecurrenceRule, today: string): boolean {
  if (!lastRecurredDate) return true;
  const nextDate = getNextOccurrenceDate(rule, lastRecurredDate);
  return nextDate <= today;
}
