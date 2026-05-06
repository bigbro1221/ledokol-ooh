import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Resolve the active VAT rate for a given moment in time.
 *
 * The match window is `validFrom <= when <= COALESCE(validTo, +infinity)`. If
 * multiple rows match (overlapping windows — should not happen but allowed
 * by the schema), the most-recent `validFrom` wins. If nothing matches the
 * caller gets `null` and is responsible for choosing a default (typically
 * "skip the VAT step and store the user-entered value verbatim").
 *
 * Returns the rate as a `number` (e.g. 0.12 for 12%) for ergonomic math; the
 * underlying Decimal precision is preserved during the lookup.
 */
export async function getVatRateAt(when: Date): Promise<number | null> {
  const row = await prisma.vatRate.findFirst({
    where: {
      isActive: true,
      validFrom: { lte: when },
      OR: [
        { validTo: null },
        { validTo: { gte: when } },
      ],
    },
    orderBy: { validFrom: 'desc' },
    select: { rate: true },
  });
  if (!row) return null;
  // Prisma gives us a Decimal; toNumber is safe for VAT-scale values
  // (5,4 fits fine in JS doubles).
  return row.rate instanceof Prisma.Decimal ? row.rate.toNumber() : Number(row.rate);
}
