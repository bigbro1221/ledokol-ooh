import type { ScreenType } from '@prisma/client';

export type SheetType = ScreenType;

interface SheetPattern {
  regex: RegExp;
  type: SheetType;
}

const SHEET_PATTERNS: SheetPattern[] = [
  { regex: /led.*ташкент/i, type: 'LED' },
  { regex: /led.*регион/i, type: 'LED' },
  { regex: /led.*остановк/i, type: 'STOP' },
  { regex: /статик/i, type: 'STATIC' },
  { regex: /аэропорт/i, type: 'AIRPORT' },
  { regex: /автобус/i, type: 'BUS' },
  { regex: /поезд/i, type: 'BUS' },
];

// Sheet names that indicate a period (month/flight) OR a combined mediaplan sheet,
// i.e. sheets with mixed screen types where the type comes from the data column.
const PERIOD_SHEET_PATTERNS = [
  /месяц/i,
  /флайт/i,
  /период/i,
  /flight/i,
  /month/i,
  /медиаплан/i,
  /mediaplan/i,
  /^\d+\s*(мес|нед|wk)/i,
];

export function detectSheetType(name: string): SheetType | null {
  const trimmed = name.trim();
  for (const { regex, type } of SHEET_PATTERNS) {
    if (regex.test(trimmed)) return type;
  }
  return null;
}

/** Returns true if the sheet represents a time period (month/flight) with mixed screen types. */
export function isPeriodSheet(name: string): boolean {
  const trimmed = name.trim();
  return PERIOD_SHEET_PATTERNS.some(p => p.test(trimmed));
}

export function isTotalSheet(name: string): boolean {
  return /^total$/i.test(name.trim());
}

/**
 * Detect ScreenType from a column value in the "Тип Внешней Рекламы" column.
 * Used for period-format sheets where the type comes from the data, not the sheet name.
 */
export function typeFromColumnValue(val: string): ScreenType | null {
  const v = val.trim().toLowerCase();
  if (!v) return null;

  if (v.includes('led') || v === 'экран' || v === 'screen' || v.includes('digital')) return 'LED';
  if (v.includes('indoor') || v.includes('индор')) return 'LED'; // no INDOOR type, map to LED
  if (v.includes('стат') || v.includes('static') || v.includes('billboard') || v.includes('билборд')) return 'STATIC';
  if (v.includes('остановк') || v.includes('stop')) return 'STOP';
  if (v.includes('аэропорт') || v.includes('airport')) return 'AIRPORT';
  if (v.includes('автобус') || v.includes('bus') || v.includes('транспорт')) return 'BUS';
  if (v.includes('метро') || v.includes('metro') || v.includes('монитор')) return 'STOP'; // metro → STOP
  return null;
}

/**
 * Detect a canonical type code (string) from a column value.
 * Includes the new types (ROOF, BRANDMAUER, CINEMA, METRO) which are not in the
 * legacy `ScreenType` enum. Used by the multi-period parser branch.
 */
export function typeCodeFromColumnValue(s: string): string | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  if (/лед|led/.test(v)) return 'LED';
  if (/остановк/.test(v)) return 'STOP';
  if (/статик/.test(v)) return 'STATIC';
  if (/аэропорт/.test(v)) return 'AIRPORT';
  if (/автобус/.test(v)) return 'BUS';
  if (/крыш/.test(v)) return 'ROOF';
  if (/брендмауэр|брендмаур|brandmauer/.test(v)) return 'BRANDMAUER';
  if (/кинотеатр|cinema/.test(v)) return 'CINEMA';
  if (/метро|metro/.test(v)) return 'METRO';
  return null;
}
