import { describe, expect, it } from 'vitest';
import { normalizeTaskText } from './taskText';

describe('normalizeTaskText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeTaskText('  write the plan  ')).toBe('write the plan');
  });

  it('collapses repeated spaces', () => {
    expect(normalizeTaskText('write   the    plan')).toBe('write the plan');
  });

  it('flattens pasted line breaks', () => {
    expect(normalizeTaskText('write\nreview\r\nship')).toBe('write review ship');
  });

  it('flattens tabs', () => {
    expect(normalizeTaskText('write\treview\tship')).toBe('write review ship');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeTaskText(' \n\t ')).toBe('');
  });
});
