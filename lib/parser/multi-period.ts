import * as XLSX from 'xlsx';
import { findHeaderRow, buildColumnMap, buildPlanFactMap } from './columns';
import { parsePeriodString, periodName } from './period';
import { ScreenRowSchema, type MultiPeriodParseResult, type CampaignData, type ParseError, type ParseWarning } from './schemas';
import { typeCodeFromColumnValue, normalizeTypeCode } from './sheets';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function getHyperlink(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[ref]?.l?.Target || null;
}

export function parseMultiPeriod(buffer: Buffer): MultiPeriodParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const rows: MultiPeriodParseResult['rows'] = [];

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { campaign: blankCampaign(), rows: [], errors: [{ sheet: '', row: 0, field: 'workbook', message: 'No sheets found' }], warnings: [] };
  }
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const headerIdx = findHeaderRow(data);
  const headerRow = (data[headerIdx] || []) as string[];
  const colMap = buildColumnMap(headerRow);
  const pfMap = buildPlanFactMap(data, headerIdx, headerRow);

  // Locate the period column ("Период размещения")
  const periodCol = headerRow.findIndex(c =>
    typeof c === 'string' && /период\s+размещени/i.test(c.trim()),
  );
  if (periodCol < 0) {
    errors.push({ sheet: sheetName, row: headerIdx + 1, field: 'period', message: 'Column "Период размещения" not found' });
  }

  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r] as unknown[];
    if (!row) continue;

    const city = colMap.city !== undefined ? String(row[colMap.city] || '').trim() : '';
    const address = colMap.address !== undefined ? String(row[colMap.address] || '').trim() : '';
    if (!city && !address) continue;

    const typeStr = (colMap.type !== undefined ? String(row[colMap.type] || '') : '').trim();
    if (!typeStr) {
      errors.push({ sheet: sheetName, row: r + 1, field: 'type', message: 'Type column is empty' });
      continue;
    }
    // Try aliases first; fall back to a normalised code derived from the input.
    // The confirm route auto-creates a ScreenTypeRef for any code not yet in the
    // table, so unknown types no longer block the upload — they show up as new
    // entries the admin can rename/merge later.
    const typeCode = typeCodeFromColumnValue(typeStr) ?? normalizeTypeCode(typeStr);
    if (!typeCode) {
      errors.push({ sheet: sheetName, row: r + 1, field: 'type', message: `Could not derive a code from type "${typeStr}"` });
      continue;
    }

    const periodRaw = periodCol >= 0 ? String(row[periodCol] || '').trim() : '';
    const period = parsePeriodString(periodRaw);
    if (!period) {
      errors.push({ sheet: sheetName, row: r + 1, field: 'period', message: `Could not parse period "${periodRaw}"` });
      continue;
    }

    const photoUrl = getHyperlink(sheet, r, colMap.photo ?? 1);
    const size = colMap.size !== undefined ? String(row[colMap.size] || '').trim() || null : null;
    const resolution = colMap.resolution !== undefined ? String(row[colMap.resolution] || '').trim() || null : null;

    // The legacy `Screen.type` enum has been removed; the parser only writes `typeCode`.
    const screen = {
      typeCode,
      typeName: typeStr,
      city: city || 'Ташкент',
      address: address || `${sheetName} — строка ${r + 1}`,
      size,
      resolution,
      externalId: colMap.externalId !== undefined ? String(row[colMap.externalId] || '').trim() || null : null,
      photoUrl,
      impressionsPerDay: colMap.impressionsPerDay !== undefined ? parseNum(row[colMap.impressionsPerDay]) : null,
      // Pricing intentionally NOT read — multi-period campaigns supply pricing via the form
      priceUnit: null, priceDiscounted: null, priceTotal: null, priceRub: null,
      commissionPct: null, agencyFeeAmt: null, productionCost: null,
      otsPlan: pfMap.otsPlan !== undefined ? parseNum(row[pfMap.otsPlan]) : null,
      ratingPlan: pfMap.ratingPlan !== undefined ? parseNum(row[pfMap.ratingPlan]) : null,
      otsFact: pfMap.otsFact !== undefined ? parseNum(row[pfMap.otsFact]) : null,
      ratingFact: pfMap.ratingFact !== undefined ? parseNum(row[pfMap.ratingFact]) : null,
      universe: pfMap.universe !== undefined ? parseNum(row[pfMap.universe]) : null,
    };

    const result = ScreenRowSchema.safeParse(screen);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ sheet: sheetName, row: r + 1, field: issue.path.join('.'), message: issue.message });
      }
      continue;
    }

    rows.push({
      screen: result.data,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodLabel: periodName(period.periodStart, period.periodEnd),
    });
  }

  return { campaign: blankCampaign(), rows, errors, warnings };
}

function blankCampaign(): CampaignData {
  return { clientName: '', project: null, yandexMapUrl: null, totalBudgetUzs: null };
}
