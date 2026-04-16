import * as XLSX from 'xlsx';
import { detectSheetType, isTotalSheet } from './sheets';
import { findHeaderRow, buildColumnMap } from './columns';
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

  // Row 1: client name at col 3
  if (data[1]) clientName = String((data[1] as unknown[])[3] || '').trim();
  // Row 2: project at col 3
  if (data[2]) project = String((data[2] as unknown[])[3] || '').trim() || null;

  // Yandex URL: scan rows 0-10, cols 0-10 for any Yandex Maps link
  outer:
  for (let r = 0; r <= Math.min(10, data.length - 1); r++) {
    for (let c = 0; c <= 10; c++) {
      const link = getHyperlink(sheet, r, c);
      if (link && link.includes('yandex')) { yandexMapUrl = link; break outer; }
      const val = data[r] ? String((data[r] as unknown[])[c] || '') : '';
      if (val.includes('yandex.uz/maps') || val.includes('yandex.ru/maps')) { yandexMapUrl = val; break outer; }
    }
  }

  // Budget: row 10, cols 11 (UZS) and 12 (RUB)
  if (data[10]) {
    const row = data[10] as unknown[];
    totalBudgetUzs = parseNum(row[11]);
    totalBudgetRub = parseNum(row[12]);
  }

  return { clientName, project, yandexMapUrl, totalBudgetUzs, totalBudgetRub };
}

export function parseMediaPlan(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const screens: ScreenRow[] = [];

  // Parse Total sheet first
  let campaign: CampaignData = {
    clientName: '',
    project: null,
    yandexMapUrl: null,
    totalBudgetUzs: null,
    totalBudgetRub: null,
  };

  for (const sheetName of workbook.SheetNames) {
    if (isTotalSheet(sheetName)) {
      campaign = parseTotalSheet(workbook.Sheets[sheetName]);
      break;
    }
  }

  // Parse screen sheets
  for (const sheetName of workbook.SheetNames) {
    const screenType = detectSheetType(sheetName);
    if (!screenType) continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    const headerIdx = findHeaderRow(data);
    const headerRow = (data[headerIdx] || []) as string[];
    const colMap = buildColumnMap(headerRow);

    if (colMap.city === undefined && colMap.address === undefined) {
      warnings.push({ sheet: sheetName, message: 'Could not detect city or address columns' });
      continue;
    }

    for (let r = headerIdx + 1; r < data.length; r++) {
      const row = data[r] as unknown[];
      if (!row) continue;

      const city = colMap.city !== undefined ? String(row[colMap.city] || '').trim() : '';
      const address = colMap.address !== undefined ? String(row[colMap.address] || '').trim() : '';
      if (!city && !address) continue;

      // Skip summary rows
      const firstCol = String(row[0] || '').trim().toLowerCase();
      if (firstCol.includes('итого') || firstCol.includes('total') || firstCol.includes('ledokol')) continue;

      const photoUrl = getHyperlink(sheet, r, 1); // Photo always in col B
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
        priceRub: colMap.priceRub !== undefined ? parseNum(row[colMap.priceRub]) : null,
        productionCost: colMap.productionCost !== undefined ? parseNum(row[colMap.productionCost]) : null,
        ots: colMap.ots !== undefined ? parseNum(row[colMap.ots]) : null,
        rating: colMap.rating !== undefined ? parseNum(row[colMap.rating]) : null,
        universe: colMap.universe !== undefined ? parseNum(row[colMap.universe]) : null,
      };

      const result = ScreenRowSchema.safeParse(rawRow);
      if (result.success) {
        screens.push(result.data);
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            sheet: sheetName,
            row: r + 1,
            field: issue.path.join('.'),
            message: issue.message,
          });
        }
        // Still add the row with raw data (best effort)
        screens.push(rawRow as ScreenRow);
      }
    }
  }

  if (screens.length === 0) {
    warnings.push({ sheet: 'all', message: 'No screen data found in any sheet' });
  }

  return { campaign, screens, errors, warnings };
}
