import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const wb = XLSX.utils.book_new();

const headerSuper = ['', '', '', '', '', '', 'плановые охваты', '', '', 'Фактические охваты', ''];
const header = [
  'Тип Внешней Рекламы',     // A
  'Фото конструкции',        // B
  'Город',                   // C
  'Адрес расположения',      // D
  'Размер',                  // E
  'Период размещения',       // F
  'ots',                     // G — plan
  'rating',                  // H — plan
  'universe',                // I — plan
  'ots',                     // J — fact
  'rating',                  // K — fact
];

const exampleRow = [
  'Крышная конструкция',
  'Фото',
  'Ташкент',
  'Пр. Амира Темура, ор-р Про Хинкали/ТБС',
  '15.58×3',
  '01.06.2025 - 30.06.2025',
  1392831,
  79.2,
  '',
  1532112,
  87.1,
];

const data = [headerSuper, header, exampleRow];
const ws = XLSX.utils.aoa_to_sheet(data);
ws['!merges'] = [
  { s: { r: 0, c: 6 }, e: { r: 0, c: 8 } },   // G1:I1 — "плановые охваты"
  { s: { r: 0, c: 9 }, e: { r: 0, c: 10 } },  // J1:K1 — "Фактические охваты"
];
ws['!cols'] = [
  { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 36 }, { wch: 12 }, { wch: 28 },
  { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
];

XLSX.utils.book_append_sheet(wb, ws, 'Медиаплан');

const out = 'public/templates/other-carriers-template.xlsx';
mkdirSync(dirname(out), { recursive: true });
XLSX.writeFile(wb, out);
console.log('Wrote', out);
