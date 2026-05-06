import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ledokol's running default. Prior to the new VatRate table this lived in
// AppSettings.vatRate; the seed plants the same value with an open-ended
// validity window so existing campaigns resolve consistently.
const SEED_RATES = [
  {
    rate: '0.1200',
    validFrom: new Date('2019-01-01T00:00:00Z'),
    validTo: null as Date | null,
    notes: 'Initial seed — Uzbekistan VAT 12% (open-ended).',
  },
];

export async function seedVatRates() {
  // Upsert by validFrom — the seed should be re-runnable. Real admin edits
  // should happen via the (future) ref-table CRUD UI rather than this seed.
  for (const r of SEED_RATES) {
    const existing = await prisma.vatRate.findFirst({ where: { validFrom: r.validFrom } });
    if (existing) {
      await prisma.vatRate.update({ where: { id: existing.id }, data: r });
    } else {
      await prisma.vatRate.create({ data: r });
    }
  }
}

if (require.main === module) {
  seedVatRates()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
