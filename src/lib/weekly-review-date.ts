export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  return formatLocalDate(parsed) === value ? parsed : null;
}

export function shiftLocalDate(base: string, days: number): string {
  const parsed = parseLocalDate(base);
  if (!parsed) {
    console.error('[weekly-review-date] invalid shift base', { base, days });
    return base;
  }

  const next = new Date(parsed.getTime());
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
}

export function getLastNDaysWindow(days: number): { start: string; end: string } {
  const end = formatLocalDate(new Date());
  return { start: shiftLocalDate(end, -(days - 1)), end };
}

export function iterateLocalDates(start: string, end: string, maxDays = 400): string[] {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    console.error('[weekly-review-date] invalid range', { start, end });
    return [];
  }

  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const safeCount = Math.min(dayCount, maxDays);
  if (dayCount > maxDays) {
    console.error('[weekly-review-date] range capped', { start, end, dayCount, maxDays });
  }

  const dates: string[] = [];
  const cursor = new Date(startDate.getTime());
  for (let index = 0; index < safeCount; index += 1) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

