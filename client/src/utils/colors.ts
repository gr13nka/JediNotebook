import { ACTIVITY_COLORS } from '@shared/constants';

let colorIndex = 0;

export function getNextColor(usedColors: string[]): string {
  // Find the first color not yet used; if all used, cycle
  for (let i = 0; i < ACTIVITY_COLORS.length; i++) {
    const idx = (colorIndex + i) % ACTIVITY_COLORS.length;
    if (!usedColors.includes(ACTIVITY_COLORS[idx])) {
      colorIndex = idx + 1;
      return ACTIVITY_COLORS[idx];
    }
  }
  // All used, just cycle
  const color = ACTIVITY_COLORS[colorIndex % ACTIVITY_COLORS.length];
  colorIndex++;
  return color;
}

export function resetColorIndex() {
  colorIndex = 0;
}
