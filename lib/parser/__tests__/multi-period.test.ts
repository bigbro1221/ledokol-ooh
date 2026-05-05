import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { parseMultiPeriod } from '../multi-period';

function buildWorkbook(rows: (string | number)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Медиаплан');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const HEADER_SUPER = ['', '', '', '', '', '', 'плановые охваты', '', '', 'Фактические охваты', ''];
const HEADER_BASE  = ['Тип Внешней Рекламы', 'Фото конструкции', 'Город', 'Адрес расположения', 'Размер', 'Период размещения', 'ots', 'rating', 'universe', 'ots', 'rating'];

const sample = readFileSync(join(process.cwd(), 'docs/samples/other_types.xlsx'));
const result = parseMultiPeriod(sample);

assert.equal(result.errors.length, 0, `errors: ${JSON.stringify(result.errors)}`);

// Sample contains 13 monthly rows for one screen
assert.equal(result.rows.length, 13, `expected 13 rows, got ${result.rows.length}`);

// All rows are the same physical screen
const addresses = new Set(result.rows.map(r => r.screen.address.trim()));
assert.equal(addresses.size, 1, `expected 1 unique address, got ${addresses.size}`);

// All rows are typed ROOF
assert(result.rows.every(r => r.screen.typeCode === 'ROOF'));

// Periods are unique per row
const periods = new Set(result.rows.map(r => `${r.periodStart.toISOString()}_${r.periodEnd.toISOString()}`));
assert.equal(periods.size, 13);

// Plan OTS values vary
const otsValues = new Set(result.rows.map(r => r.screen.otsPlan));
assert(otsValues.size >= 10, 'expected diverse OTS values across periods');

// Period naming
const labels = result.rows.map(r => r.periodLabel);
assert(labels.includes('Май 2025'));
assert(labels.includes('Июнь 2025'));

// --- Failure modes ---

// Missing "Период размещения" column → period error on the header row
{
  const headerNoPeriod = ['Тип Внешней Рекламы', 'Фото конструкции', 'Город', 'Адрес расположения', 'Размер', 'ots', 'rating', 'universe', 'ots', 'rating'];
  const wb = buildWorkbook([
    ['', '', '', '', '', 'плановые охваты', '', '', 'Фактические охваты', ''],
    headerNoPeriod,
    ['Крышная конструкция', '', 'Ташкент', 'Адрес', '10x3', 100, 50, 1000, 110, 55],
  ]);
  const r = parseMultiPeriod(wb);
  assert(r.errors.some(e => e.field === 'period' && /not found/i.test(e.message)), 'expected period-column-missing error');
}

// Unknown type value → type error, row skipped
{
  const wb = buildWorkbook([
    HEADER_SUPER,
    HEADER_BASE,
    ['нечто непонятное', '', 'Ташкент', 'Адрес', '10x3', '01.06.2025 - 30.06.2025', 100, 50, 1000, 110, 55],
  ]);
  const r = parseMultiPeriod(wb);
  assert.equal(r.rows.length, 0);
  assert(r.errors.some(e => e.field === 'type' && /Unknown type/.test(e.message)), 'expected unknown-type error');
}

// Malformed period string → period error, row skipped
{
  const wb = buildWorkbook([
    HEADER_SUPER,
    HEADER_BASE,
    ['Крышная конструкция', '', 'Ташкент', 'Адрес', '10x3', 'не дата', 100, 50, 1000, 110, 55],
  ]);
  const r = parseMultiPeriod(wb);
  assert.equal(r.rows.length, 0);
  assert(r.errors.some(e => e.field === 'period' && /Could not parse period/.test(e.message)), 'expected malformed-period error');
}
