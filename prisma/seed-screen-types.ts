import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TYPES = [
  // existing — keep codes stable, they match the legacy enum values
  { code: 'LED',        nameRu: 'Лед экраны',              nameEn: 'LED screens',        nameUz: 'LED ekranlar',         category: 'SCREENS',        sortOrder: 10 },
  { code: 'STATIC',     nameRu: 'Статические щиты',        nameEn: 'Static boards',      nameUz: 'Statik bannerlar',     category: 'SCREENS',        sortOrder: 20 },
  { code: 'STOP',       nameRu: 'Диджитальные остановки',  nameEn: 'Digital stops',      nameUz: 'Raqamli bekatlar',     category: 'SCREENS',        sortOrder: 30 },
  { code: 'AIRPORT',    nameRu: 'Аэропорт',                nameEn: 'Airport',            nameUz: 'Aeroport',             category: 'SCREENS',        sortOrder: 40 },
  { code: 'BUS',        nameRu: 'Автобусы',                nameEn: 'Buses',              nameUz: 'Avtobuslar',           category: 'OTHER_CARRIERS', sortOrder: 50 },
  // new — Другие носители
  { code: 'ROOF',       nameRu: 'Крышные конструкции',     nameEn: 'Rooftop structures', nameUz: 'Tom konstruksiyalari', category: 'OTHER_CARRIERS', sortOrder: 60 },
  { code: 'BRANDMAUER', nameRu: 'Брендмауры',              nameEn: 'Brandmauers',        nameUz: 'Brendmauerlar',        category: 'OTHER_CARRIERS', sortOrder: 70 },
  { code: 'CINEMA',     nameRu: 'Кинотеатры',              nameEn: 'Cinemas',            nameUz: 'Kinoteatrlar',         category: 'OTHER_CARRIERS', sortOrder: 80 },
  { code: 'METRO',      nameRu: 'Метро',                   nameEn: 'Metro',              nameUz: 'Metro',                category: 'OTHER_CARRIERS', sortOrder: 90 },
];

export async function seedScreenTypes() {
  for (const t of TYPES) {
    // The Prisma model name `ScreenTypeRef` is retained after the legacy
    // `enum ScreenType` was dropped — renaming would break Screen.typeId FKs.
    await prisma.screenTypeRef.upsert({
      where: { code: t.code },
      create: t,
      update: {
        nameRu: t.nameRu,
        nameEn: t.nameEn,
        nameUz: t.nameUz,
        category: t.category,
        sortOrder: t.sortOrder,
      },
    });
  }
}

if (require.main === module) {
  seedScreenTypes()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      return prisma.$disconnect().then(() => process.exit(1));
    });
}
