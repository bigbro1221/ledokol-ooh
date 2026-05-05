const RU_MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

function parseSingleDate(s: string): Date | null {
  const m = s.trim().match(DATE_RE);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(d.getTime())) return null;
  // Reject impossible dates that Date.UTC silently rolls over (31.06 → 01.07).
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1 || d.getUTCFullYear() !== year) {
    return null;
  }
  return d;
}

export interface ParsedPeriod {
  periodStart: Date;
  periodEnd: Date;
}

export function parsePeriodString(raw: string): ParsedPeriod | null {
  if (!raw) return null;
  // Split on hyphen-minus, en-dash, em-dash, surrounded by optional whitespace
  const parts = raw.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return null;
  const start = parseSingleDate(parts[0]);
  const end = parseSingleDate(parts[1]);
  if (!start || !end) return null;
  if (end < start) return null;
  return { periodStart: start, periodEnd: end };
}

function isLastDayOfMonth(d: Date): boolean {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return next.getUTCMonth() !== d.getUTCMonth();
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function periodName(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  // "Full month": starts on day 1 OR before, ends on last day of that month
  if (sameMonth && start.getUTCDate() <= 5 && isLastDayOfMonth(end)) {
    return `${RU_MONTHS_NOM[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  const fmt = (d: Date) =>
    `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}
