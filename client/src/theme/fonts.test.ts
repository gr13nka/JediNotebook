import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_FONT, FONT_PRESETS, resolveAppFont } from './fonts';

describe('font presets', () => {
  it('offers the four curated global typefaces', () => {
    expect(FONT_PRESETS.map((font) => font.id)).toEqual([
      'source-serif-4',
      'ibm-plex-sans',
      'nunito-sans',
      'departure-mono',
    ]);
  });

  it('uses Source Serif 4 for missing or invalid saved preferences', () => {
    expect(DEFAULT_APP_FONT).toBe('source-serif-4');
    expect(resolveAppFont(undefined)).toBe(DEFAULT_APP_FONT);
    expect(resolveAppFont('classic-inter')).toBe(DEFAULT_APP_FONT);
    expect(resolveAppFont('departure-mono')).toBe('departure-mono');
  });
});
