function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateDisplay(value: string | Date | null | undefined): string {
  const parsed = parseDateValue(value);
  if (!parsed) return 'UNKNOWN';
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
}

export function formatDateTimeDisplay(value: string | Date | null | undefined): string {
  const parsed = parseDateValue(value);
  if (!parsed) return 'UNKNOWN';
  return `${formatDateDisplay(parsed)} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function formatDateWithWeekday(value: string | Date | null | undefined, weekday: 'short' | 'long' = 'long'): string {
  const parsed = parseDateValue(value);
  if (!parsed) return 'UNKNOWN';
  const weekdayLabel = parsed.toLocaleDateString('en-GB', { weekday }).toUpperCase();
  return `${weekdayLabel} ${formatDateDisplay(parsed)}`;
}

export function formatDateRangeDisplay(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
  return `${formatDateDisplay(start)} TO ${formatDateDisplay(end)}`;
}
