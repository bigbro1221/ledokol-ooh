import { PrismaClient, ScreenType } from '@prisma/client';
import { hash } from 'bcryptjs';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// Sheet name → ScreenType mapping
function detectSheetType(name: string): ScreenType | null {
  const n = name.toLowerCase().trim();
  if (/led.*ташкент/.test(n)) return 'LED';
  if (/led.*регион/.test(n)) return 'LED';
  if (/led.*остановк/.test(n)) return 'STOP';
  if (/статик/.test(n)) return 'STATIC';
  if (/аэропорт/.test(n)) return 'AIRPORT';
  if (/автобус/.test(n)) return 'BUS';
  if (/поезд/.test(n)) return 'BUS'; // Trains → BUS category
  return null;
}

// Find header row index (look for "Город" or "Адрес" in first 10 rows)
function findHeaderRow(data: unknown[][]): number {
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r] as string[];
    if (row?.some(cell => typeof cell === 'string' && /город|адрес расположения/i.test(cell.trim()))) {
      return r;
    }
  }
  return 7; // fallback
}

// Map header names to column indices
function buildColumnMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    type: ['Тип Внешней Рекламы', 'Тип внешней рекламы'],
    city: ['Город'],
    address: ['Адрес расположения'],
    size: ['Размер конструкции'],
    resolution: ['Разрешение'],
    priceUnit: ['Стоимость за 1 единицу (без АК и НДС)', 'Стоимость за 1 единицу (без НДС)', 'Стоимость за 1 единицу ( без НДС)'],
    priceDiscounted: ['Цена с учетом скидки'],
    priceRub: ['Цена с учетом скидки  в RUB', 'Стоимость за 1 ед   в RUB', 'Цена с учетом скидки в RUB'],
    externalId: ['id', 'ID'],
    productionCost: ['Стоимость производства'],
  };

  for (const [key, names] of Object.entries(aliases)) {
    for (let c = 0; c < headerRow.length; c++) {
      const cell = String(headerRow[c] || '').trim();
      if (names.some(n => cell.toLowerCase().startsWith(n.toLowerCase()))) {
        map[key] = c;
        break;
      }
    }
  }
  return map;
}

// Extract photo URL from hyperlink
function getPhotoUrl(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[cellRef];
  return cell?.l?.Target || null;
}

// Parse a number, handling various formats
function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function toBigIntOrNull(val: unknown): bigint | null {
  const n = parseNum(val);
  return n !== null ? BigInt(Math.round(n)) : null;
}

async function main() {
  console.log('Cleaning existing data...');
  await prisma.impression.deleteMany();
  await prisma.screenMetrics.deleteMany();
  await prisma.screenPricing.deleteMany();
  await prisma.screen.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();

  // Create client
  const client = await prisma.client.create({
    data: {
      name: 'Т-банк',
      contactPerson: 'Контактное лицо',
    },
  });
  console.log(`Created client: ${client.name} (${client.id})`);

  // Create admin user
  const adminHash = await hash('admin123', 12);
  await prisma.user.create({
    data: {
      email: 'admin@ledokol.uz',
      passwordHash: adminHash,
      role: 'ADMIN',
      language: 'RU',
    },
  });
  console.log('Created admin user: admin@ledokol.uz / admin123');

  // Create client user
  const clientHash = await hash('client123', 12);
  await prisma.user.create({
    data: {
      email: 'client@tbank.uz',
      passwordHash: clientHash,
      role: 'CLIENT',
      language: 'RU',
      clientId: client.id,
    },
  });
  console.log('Created client user: client@tbank.uz / client123');

  // Read XLSX
  const filePath = path.join(__dirname, '..', 'docs', 'samples', 'ЧЕРНОВИК.xlsx');
  const workbook = XLSX.readFile(filePath);

  // Extract Yandex Maps URL from Total sheet
  const totalSheet = workbook.Sheets['Total'];
  let yandexMapUrl: string | null = null;
  // Check row 3, col 5-6 area for the URL
  for (let c = 4; c <= 7; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 3, c });
    const cell = totalSheet[cellRef];
    if (cell?.l?.Target && cell.l.Target.includes('yandex')) {
      yandexMapUrl = cell.l.Target;
      break;
    }
    if (cell?.v && String(cell.v).includes('yandex')) {
      yandexMapUrl = String(cell.v);
      break;
    }
  }

  // Extract budget from Total sheet row 10
  const totalData = XLSX.utils.sheet_to_json(totalSheet, { header: 1, defval: '' }) as unknown[][];
  let totalBudgetUzs: bigint | null = null;
  let totalBudgetRub: bigint | null = null;
  if (totalData[10]) {
    const row10 = totalData[10] as unknown[];
    totalBudgetUzs = toBigIntOrNull(row10[11]); // "Итого в UZS" column
    totalBudgetRub = toBigIntOrNull(row10[12]); // "Итого в RUB" column
  }

  // Create campaign
  const campaign = await prisma.campaign.create({
    data: {
      clientId: client.id,
      name: 'Размещение наружной рекламы в Узбекистане — Т-банк 2026',
      project: 'Т-банк OOH 2026',
      periodStart: new Date('2026-01-09'),
      periodEnd: new Date('2026-03-08'),
      status: 'ACTIVE',
      yandexMapUrl,
      totalBudgetUzs,
      totalBudgetRub,
    },
  });
  console.log(`Created campaign: ${campaign.name}`);
  console.log(`  Budget: ${totalBudgetUzs?.toLocaleString()} UZS / ${totalBudgetRub?.toLocaleString()} RUB`);
  console.log(`  Yandex Map: ${yandexMapUrl ? 'found' : 'not found'}`);

  // Parse each sheet
  let totalScreens = 0;
  const typeCounts: Record<string, number> = {};

  for (const sheetName of workbook.SheetNames) {
    const screenType = detectSheetType(sheetName);
    if (!screenType) {
      console.log(`Skipping sheet: "${sheetName}" (not a screen sheet)`);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    const headerRowIdx = findHeaderRow(data);
    const headerRow = (data[headerRowIdx] || []) as string[];
    const colMap = buildColumnMap(headerRow);

    // Photo is always column B (index 1)
    const photoCol = 1;

    let sheetScreens = 0;

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r] as unknown[];
      if (!row) continue;

      // Skip empty rows — need at least a city or address
      const city = String(row[colMap.city] || '').trim();
      const address = String(row[colMap.address] || '').trim();
      if (!city && !address) continue;

      // Skip summary/total rows
      const firstCol = String(row[0] || '').trim().toLowerCase();
      if (firstCol.includes('итого') || firstCol.includes('total') || firstCol.includes('ledokol')) continue;

      const photoUrl = getPhotoUrl(sheet, r, photoCol);
      const size = String(row[colMap.size] || '').trim() || null;
      const resolution = colMap.resolution !== undefined ? String(row[colMap.resolution] || '').trim() || null : null;
      const externalId = colMap.externalId !== undefined ? String(row[colMap.externalId] || '').trim() || null : null;

      const priceUnit = colMap.priceUnit !== undefined ? toBigIntOrNull(row[colMap.priceUnit]) : null;
      const priceDiscounted = colMap.priceDiscounted !== undefined ? toBigIntOrNull(row[colMap.priceDiscounted]) : null;
      const priceRub = colMap.priceRub !== undefined ? toBigIntOrNull(row[colMap.priceRub]) : null;
      const productionCost = colMap.productionCost !== undefined ? toBigIntOrNull(row[colMap.productionCost]) : null;

      try {
        const screen = await prisma.screen.create({
          data: {
            campaignId: campaign.id,
            externalId,
            type: screenType,
            city: city || 'Ташкент',
            address: address || `${sheetName} — строка ${r + 1}`,
            size,
            resolution: resolution !== 'х' && resolution !== 'x' ? resolution : null,
            photoUrl,
            pricing: (priceUnit || priceDiscounted || priceRub || productionCost)
              ? {
                  create: {
                    priceUnit,
                    priceDiscounted,
                    priceRub,
                    productionCost,
                  },
                }
              : undefined,
            metrics: {
              create: {
                otsPlan: Math.round(3000 + Math.random() * 7000),
                ratingPlan: Number((Math.random() * 5).toFixed(2)),
                universe: Math.round(50000 + Math.random() * 200000),
                source: 'XLSX',
              },
            },
          },
        });

        sheetScreens++;
        totalScreens++;

        // Suppress unused variable warning
        void screen;
      } catch (err) {
        console.error(`  Error on row ${r + 1} of "${sheetName}":`, err instanceof Error ? err.message : err);
      }
    }

    typeCounts[`${screenType} (${sheetName})`] = sheetScreens;
    console.log(`  Sheet "${sheetName}" → ${screenType}: ${sheetScreens} screens`);
  }

  console.log(`\n=== SEED COMPLETE ===`);
  console.log(`Total screens: ${totalScreens}`);
  console.log(`By type:`);
  for (const [key, count] of Object.entries(typeCounts)) {
    console.log(`  ${key}: ${count}`);
  }
  console.log(`\nUsers:`);
  console.log(`  admin@ledokol.uz / admin123 (ADMIN)`);
  console.log(`  client@tbank.uz / client123 (CLIENT → ${client.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
