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

// Shared alias table for screen-type detection from the "Тип Внешней Рекламы" column.
// Order matters: more-specific matches must come before broader ones (e.g. "брендмауэр"
// must match before any "стат" rule, which is why STATIC sits below BRANDMAUER below).
// Each entry: { code, patterns[] } where any matching pattern resolves to that code.
const TYPE_CODE_ALIASES: { code: string; patterns: RegExp[] }[] = [
  { code: 'BRANDMAUER', patterns: [/брендмауэр|брендмаур|brandmauer/] },
  { code: 'ROOF',       patterns: [/крыш/] },
  { code: 'CINEMA',     patterns: [/кинотеатр|cinema/] },
  { code: 'METRO',      patterns: [/метро|metro/] },
  { code: 'STOP',       patterns: [/остановк|^stop\b|\bstop\b/] },
  { code: 'AIRPORT',    patterns: [/аэропорт|airport/] },
  { code: 'BUS',        patterns: [/автобус|\bbus\b|транспорт/] },
  { code: 'LED',        patterns: [/лед|led|^экран$|^screen$|digital|indoor|индор|монитор/] },
  { code: 'STATIC',     patterns: [/стат|static|billboard|билборд/] },
];

/**
 * Detect a canonical type code (string) from a column value.
 * Returns one of: LED, STATIC, STOP, AIRPORT, BUS, ROOF, BRANDMAUER, CINEMA, METRO.
 * Used by the multi-period parser branch and (transitively) by typeFromColumnValue.
 */
export function typeCodeFromColumnValue(s: string): string | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  for (const { code, patterns } of TYPE_CODE_ALIASES) {
    if (patterns.some(p => p.test(v))) return code;
  }
  return null;
}

// Map canonical codes to the legacy `ScreenType` enum. Codes that don't have a
// direct enum value (ROOF, BRANDMAUER, CINEMA) fall back to STATIC; METRO maps
// to STOP to preserve previous behavior. Removed in Task 13 alongside the enum.
export const LEGACY_ENUM_BY_CODE: Record<string, ScreenType> = {
  LED: 'LED',
  STATIC: 'STATIC',
  STOP: 'STOP',
  AIRPORT: 'AIRPORT',
  BUS: 'BUS',
  ROOF: 'STATIC',
  BRANDMAUER: 'STATIC',
  CINEMA: 'STATIC',
  METRO: 'STOP',
};

/**
 * Detect ScreenType from a column value. Used by the legacy single-period parser
 * for sheets where the type comes from the data, not the sheet name. Delegates to
 * typeCodeFromColumnValue so both resolvers share a single alias table.
 */
export function typeFromColumnValue(val: string): ScreenType | null {
  const code = typeCodeFromColumnValue(val);
  return code ? LEGACY_ENUM_BY_CODE[code] : null;
}
