import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { totalBudgetRub: { not: null } },
    select: { id: true, totalBudgetRub: true },
  });
  for (const c of campaigns) {
    if (c.totalBudgetRub == null) continue;
    await prisma.campaign.update({
      where: { id: c.id },
      data: {
        additionalCurrency: 'RUB',
        additionalAmount: c.totalBudgetRub,
      },
    });
  }
  console.log(`Backfilled ${campaigns.length} campaigns`);
}

main().finally(() => prisma.$disconnect());
