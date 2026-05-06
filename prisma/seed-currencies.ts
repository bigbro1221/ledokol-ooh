import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CURRENCIES = [
  { code: 'UZS', nameRu: 'Узбекский сум',     nameEn: 'Uzbekistani sum', nameUz: 'O\'zbek so\'mi',     sortOrder: 10 },
  { code: 'RUB', nameRu: 'Российский рубль',  nameEn: 'Russian ruble',   nameUz: 'Rossiya rubli',      sortOrder: 20 },
  { code: 'USD', nameRu: 'Доллар США',        nameEn: 'US dollar',       nameUz: 'AQSH dollari',       sortOrder: 30 },
];

export async function seedCurrencies() {
  for (const c of CURRENCIES) {
    await prisma.currencyRef.upsert({
      where: { code: c.code },
      create: c,
      update: { nameRu: c.nameRu, nameEn: c.nameEn, nameUz: c.nameUz, sortOrder: c.sortOrder },
    });
  }
}

if (require.main === module) {
  seedCurrencies()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
