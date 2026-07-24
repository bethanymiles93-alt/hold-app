import type { HoldPeriod } from "@/types/hold";

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.slice(0, 2).join(" ");
}

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(ms));
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(ms: number): Date {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isDateInPeriod(date: Date, period: HoldPeriod): boolean {
  if (period.endedAt === null) return false;

  const time = date.getTime();
  return time >= startOfDay(period.startedAt).getTime() && time <= startOfDay(period.endedAt).getTime();
}

/** Every calendar cell (7 per row, `null` for blanks) for the given month, local time. */
export function buildMonthGrid(monthStart: Date): Array<Date | null> {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = new Date(year, month, 1).getDay();

  const cells: Array<Date | null> = Array.from({ length: leadingBlanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  return cells;
}

export interface DayBand {
  periodId: string;
  roundStart: boolean;
  roundEnd: boolean;
}

/**
 * For each day in a rendered month grid that falls inside a closed Hold period,
 * works out whether that day's edges should be rounded — so consecutive days from
 * the same period, within the same calendar row, render as one connected band
 * instead of separate per-day marks. A period that spans a week boundary gets a
 * fresh rounded segment on each row, since a wrapped grid can't visually join rows.
 */
export function getDayBands(
  periods: HoldPeriod[],
  grid: Array<Date | null>
): Map<string, DayBand> {
  const bands = new Map<string, DayBand>();
  const closedPeriods = periods.filter((period) => period.endedAt !== null);

  for (let rowStart = 0; rowStart < grid.length; rowStart += 7) {
    const week = grid.slice(rowStart, rowStart + 7);

    week.forEach((date, col) => {
      if (!date) return;

      const period = closedPeriods.find((candidate) => isDateInPeriod(date, candidate));
      if (!period) return;

      const prevDate = col > 0 ? week[col - 1] : null;
      const nextDate = col < week.length - 1 ? week[col + 1] : null;

      const continuesFromPrev = Boolean(prevDate && isDateInPeriod(prevDate, period));
      const continuesToNext = Boolean(nextDate && isDateInPeriod(nextDate, period));

      bands.set(dateKey(date), {
        periodId: period.id,
        roundStart: !continuesFromPrev,
        roundEnd: !continuesToNext
      });
    });
  }

  return bands;
}
