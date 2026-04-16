import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '..', 'docs', 'samples', 'ЧЕРНОВИК.xlsx');
const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });

console.log('=== SHEET NAMES ===');
workbook.SheetNames.forEach((name, i) => console.log(`  ${i}: "${name}"`));

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  console.log(`\n=== SHEET: "${sheetName}" (rows: ${range.e.r + 1}, cols: ${range.e.c + 1}) ===`);

  // Print first 12 rows to understand headers and data
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  for (let r = 0; r < Math.min(12, data.length); r++) {
    const row = data[r] as unknown[];
    const cells = row.slice(0, 15).map((v, c) => {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellRef];
      const link = cell?.l?.Target ? ` [LINK:${cell.l.Target.substring(0, 60)}]` : '';
      const val = String(v).substring(0, 40);
      return val + link;
    });
    console.log(`  Row ${r}: ${JSON.stringify(cells)}`);
  }

  // Count data rows (non-empty after header)
  let dataRows = 0;
  for (let r = 8; r <= range.e.r; r++) {
    const cellB = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
    const cellC = sheet[XLSX.utils.encode_cell({ r, c: 2 })];
    if (cellB?.v || cellC?.v) dataRows++;
  }
  console.log(`  Data rows (after row 8): ~${dataRows}`);
}
