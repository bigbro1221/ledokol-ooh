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

export function detectSheetType(name: string): SheetType | null {
  const trimmed = name.trim();
  for (const { regex, type } of SHEET_PATTERNS) {
    if (regex.test(trimmed)) return type;
  }
  return null;
}

export function isTotalSheet(name: string): boolean {
  return /^total$/i.test(name.trim());
}
