// JSON serializers for Prisma models. Prisma represents money/big-int columns as
// `bigint`, which Next.js's NextResponse.json cannot serialize without a shim.
// These helpers convert the relevant fields to `number | null` for the wire.

const bigintToNumber = (v: bigint | null | undefined): number | null =>
  v != null ? Number(v) : null;

type CampaignBigIntFields = {
  totalBudgetUzs: bigint | null;
  totalBudgetRub: bigint | null;
  productionCost: bigint | null;
  totalFinal: bigint | null;
  additionalAmount: bigint | null;
};

export function serializeCampaign<T extends Partial<CampaignBigIntFields>>(c: T) {
  return {
    ...c,
    totalBudgetUzs: bigintToNumber(c.totalBudgetUzs),
    totalBudgetRub: bigintToNumber(c.totalBudgetRub),
    productionCost: bigintToNumber(c.productionCost),
    totalFinal: bigintToNumber(c.totalFinal),
    additionalAmount: bigintToNumber(c.additionalAmount),
  };
}

type PeriodBigIntFields = {
  totalBudgetUzs: bigint | null;
  productionCost: bigint | null;
  totalFinal: bigint | null;
  additionalAmount: bigint | null;
};

export function serializePeriod<T extends Partial<PeriodBigIntFields>>(p: T) {
  return {
    ...p,
    totalBudgetUzs: bigintToNumber(p.totalBudgetUzs),
    productionCost: bigintToNumber(p.productionCost),
    totalFinal: bigintToNumber(p.totalFinal),
    additionalAmount: bigintToNumber(p.additionalAmount),
  };
}
