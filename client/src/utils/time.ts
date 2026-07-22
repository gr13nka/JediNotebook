// Durations are clamped at zero. Clock skew between synced devices can make a
// naive `now - startedAt` go negative, and padStart() leaves the minus sign in
// place — which surfaced as "-36:-32" on screen.
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

export function formatDurationLong(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function getLogicalDate(dayStartHour: number, reference: Date = new Date()): string {
  const adjusted = new Date(reference);
  if (reference.getHours() < dayStartHour) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  // Built from LOCAL date components (not toISOString(), which serializes in
  // UTC) — the hour comparison above is local, so the output must be too.
  // Mixing the two made the logical date jump an extra day east of UTC
  // (local hour already past dayStartHour, but UTC date still one behind).
  return `${adjusted.getFullYear()}-${pad(adjusted.getMonth() + 1)}-${pad(adjusted.getDate())}`;
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
