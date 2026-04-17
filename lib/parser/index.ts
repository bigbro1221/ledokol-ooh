import * as XLSX from 'xlsx';
import { detectSheetType, isPeriodSheet, isTotalSheet, typeFromColumnValue } from './sheets';
import { findHeaderRow, buildColumnMap, buildPlanFactMap } from './columns';
import { ScreenRowSchema, type ParseResult, type ScreenRow, type ParseError, type ParseWarning, type CampaignData } from './schemas';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function getHyperlink(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[ref]?.l?.Target || null;
}

function parseTotalSheet(sheet: XLSX.WorkSheet): CampaignData {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

  let clientName = '';
  let project: string | null = null;
  let yandexMapUrl: string | null = null;
  let totalBudgetUzs: number | null = null;
  let totalBudgetRub: number | null = null;

  if (data[1]) clientName = String((data[1] as unknown[])[3] || '').trim();
  if (data[2]) project = String((data[2] as unknown[])[3] || '').trim() || null;

  outer:
  for (let r = 0; r <= Math.min(10, data.length - 1); r++) {
    for (let c = 0; c <= 10; c++) {
      const link = getHyperlink(sheet, r, c);
      if (link && link.includes('yandex')) { yandexMapUrl = link; break outer; }
      const val = data[r] ? String((data[r] as unknown[])[c] || '') : '';
      if (val.includes('yandex.uz/maps') || val.includes('yandex.ru/maps')) { yandexMapUrl = val; break outer; }
    }
  }

  if (data[10]) {
    const row = data[10] as unknown[];
    totalBudgetUzs = parseNum(row[11]);
    totalBudgetRub = parseNum(row[12]);
  }

  return { clientName, project, yandexMapUrl, totalBudgetUzs, totalBudgetRub };
}

function parseScreenSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet,
  fixedType: import('@prisma/client').ScreenType | null,
  errors: ParseError[],
  warnings: ParseWarning[],
): ScreenRow[] {
  const screens: ScreenRow[] = [];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const headerIdx = findHeaderRow(data);
  const headerRow = (data[headerIdx] || []) as string[];
  const colMap = buildColumnMap(headerRow);
  const pfMap = buildPlanFactMap(data, headerIdx, headerRow);

  if (colMap.city === undefined && colMap.address === undefined) {
    warnings.push({ sheet: sheetName, message: 'Could not detect city or address columns' });
    return screens;
  }

  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r] as unknown[];
    if (!row) continue;

    const city = colMap.city !== undefined ? String(row[colMap.city] || '').trim() : '';
    const address = colMap.address !== undefined ? String(row[colMap.address] || '').trim() : '';
    if (!city && !address) continue;

    const firstCol = String(row[0] || '').trim().toLowerCase();
    if (firstCol.includes('итого') || firstCol.includes('total') || firstCol.includes('ledokol')) continue;

    // For period sheets, derive type from the type column; otherwise use the fixed sheet type
    let screenType: import('@prisma/client').ScreenType | null = fixedType;
    if (!screenType && colMap.type !== undefined) {
      screenType = typeFromColumnValue(String(row[colMap.type] || ''));
    }
    if (!screenType) {
      // Skip rows where we can't determine type
      continue;
    }

    const photoUrl = getHyperlink(sheet, r, 1);
    const size = colMap.size !== undefined ? String(row[colMap.size] || '').trim() || null : null;
    let resolution = colMap.resolution !== undefined ? String(row[colMap.resolution] || '').trim() || null : null;
    if (resolution === 'х' || resolution === 'x') resolution = null;

    const rawRow = {
      type: screenType,
      city: city || 'Ташкент',
      address: address || `${sheetName} — строка ${r + 1}`,
      size,
      resolution,
      externalId: colMap.externalId !== undefined ? String(row[colMap.externalId] || '').trim() || null : null,
      photoUrl,
      priceUnit: colMap.priceUnit !== undefined ? parseNum(row[colMap.priceUnit]) : null,
      priceDiscounted: colMap.priceDiscounted !== undefined ? parseNum(row[colMap.priceDiscounted]) : null,
      priceTotal: colMap.priceTotal !== undefined ? parseNum(row[colMap.priceTotal]) : null,
      priceRub: colMap.priceRub !== undefined ? parseNum(row[colMap.priceRub]) : null,
      commissionPct: colMap.commissionPct !== undefined ? parseNum(row[colMap.commissionPct]) : null,
      agencyFeeAmt: colMap.agencyFeeAmt !== undefined ? parseNum(row[colMap.agencyFeeAmt]) : null,
      productionCost: colMap.productionCost !== undefined ? parseNum(row[colMap.productionCost]) : null,
      otsPlan: pfMap.otsPlan !== undefined ? parseNum(row[pfMap.otsPlan]) : null,
      ratingPlan: pfMap.ratingPlan !== undefined ? parseNum(row[pfMap.ratingPlan]) : null,
      otsFact: pfMap.otsFact !== undefined ? parseNum(row[pfMap.otsFact]) : null,
      ratingFact: pfMap.ratingFact !== undefined ? parseNum(row[pfMap.ratingFact]) : null,
      universe: pfMap.universe !== undefined ? parseNum(row[pfMap.universe]) : null,
    };

    const result = ScreenRowSchema.safeParse(rawRow);
    if (result.success) {
      screens.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        errors.push({ sheet: sheetName, row: r + 1, field: issue.path.join('.'), message: issue.message });
      }
      screens.push(rawRow as ScreenRow);
    }
  }

  return screens;
}

export function parseMediaPlan(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const screens: ScreenRow[] = [];

  let campaign: CampaignData = {
    clientName: '',
    project: null,
    yandexMapUrl: null,
    totalBudgetUzs: null,
    totalBudgetRub: null,
  };

  // Parse Total sheet
  for (const sheetName of workbook.SheetNames) {
    if (isTotalSheet(sheetName)) {
      campaign = parseTotalSheet(workbook.Sheets[sheetName]);
      break;
    }
  }

  // Parse screen sheets — both type-named sheets and period sheets
  for (const sheetName of workbook.SheetNames) {
    if (isTotalSheet(sheetName)) continue;

    const fixedType = detectSheetType(sheetName);    // e.g. "LED Ташкент" → LED
    const isPeriod = isPeriodSheet(sheetName);       // e.g. "Первый месяц"

    if (!fixedType && !isPeriod) continue; // skip unrecognised sheets (flowchart, справочник, etc.)

    const sheetScreens = parseScreenSheet(
      sheetName,
      workbook.Sheets[sheetName],
      fixedType, // null for period sheets → type comes from column
      errors,
      warnings,
    );
    screens.push(...sheetScreens);
  }

  if (screens.length === 0) {
    warnings.push({ sheet: 'all', message: 'No screen data found in any sheet' });
  }

  return { campaign, screens, errors, warnings };
}
