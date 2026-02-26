export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

export function formatDurationLong(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function getLogicalDate(dayStartHour: number): string {
  const now = new Date();
  const adjusted = new Date(now);
  if (now.getHours() < dayStartHour) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return adjusted.toISOString().split('T')[0];
}

export function getTodayRange(dayStartHour: number): { start: Date; end: Date } {
  const today = getLogicalDate(dayStartHour);
  const start = new Date(today + 'T00:00:00');
  start.setHours(dayStartHour, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function getProgressRatio(
  elapsedSeconds: number,
  budgetMinutes: number,
): number {
  if (budgetMinutes <= 0) return 0;
  return elapsedSeconds / (budgetMinutes * 60);
}

export function getOverfillColor(
  ratio: number,
  baseColor: string,
): string {
  if (ratio <= 1.0) return baseColor;
  if (ratio <= 1.5) return '#C0792E'; // orange/warning
  return '#C0392B'; // red/danger
}
