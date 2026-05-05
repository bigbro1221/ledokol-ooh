// One-shot backfill paired with Task 2 of the other-carriers-template plan.
// Copies legacy Campaign.totalBudgetRub into the new generic
// (additionalCurrency='RUB', additionalAmount) pair. Idempotent — skips
// campaigns whose additionalAmount is already populated, so re-runs won't
// clobber values entered by users in another currency.
//
// Run with: npx tsx prisma/migrations/manual/2026-05-05-currency-backfill.ts
// Must be run against every environment before Task 13 drops totalBudgetRub.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { totalBudgetRub: { not: null }, additionalAmount: null },
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

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
