import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MediaType } from '@prisma/client';
import { requireAdmin } from '@/lib/api-auth';
import { serializeCampaign } from '@/lib/serializers';
import { getVatRateAt } from '@/lib/vat';

const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  clientId: z.string().uuid('Invalid client'),
  periodStart: z.string().transform(s => new Date(s)),
  periodEnd: z.string().transform(s => new Date(s)),
  splitByPeriods: z.boolean().optional().default(false),
  heatmapUrl: z.string().url().optional().nullable(),
  yandexMapUrl: z.string().url().optional().nullable(),
  reportsUrl: z.string().url().optional().nullable(),
  acRate: z.number().min(0).max(1).optional().default(0),
  mediaType: z.nativeEnum(MediaType).optional().default('SCREENS'),
  additionalCurrencyId: z.string().uuid().nullable().optional(),
  additionalAmount: z.number().nullable().optional(),
  totalBudgetUzs: z.number().nullable().optional(),
  productionCost: z.number().nullable().optional(),
  // totalFinal accepted for SCREENS-mode legacy callers; OTHER_CARRIERS overrides
  // it server-side from totalBudgetUzs × (1 + VAT@periodStart).
  totalFinal: z.number().nullable().optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const campaigns = await prisma.campaign.findMany({
    include: {
      client: { select: { name: true } },
      _count: { select: { screens: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(campaigns);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = CreateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
    }

    const { additionalAmount, totalBudgetUzs, productionCost, totalFinal, ...rest } = parsed.data;

    // OTHER_CARRIERS: totalFinal is auto-computed from totalBudgetUzs and the
    // VAT rate active at periodStart. Any client-supplied totalFinal is
    // ignored. SCREENS: totalFinal is whatever the client sent (legacy path).
    let resolvedTotalFinal: number | null | undefined = totalFinal ?? undefined;
    if (rest.mediaType === 'OTHER_CARRIERS') {
      if (totalBudgetUzs != null) {
        const vat = (await getVatRateAt(rest.periodStart)) ?? 0;
        resolvedTotalFinal = Math.round(totalBudgetUzs * (1 + vat));
      } else {
        resolvedTotalFinal = null;
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        ...rest,
        ...(totalBudgetUzs != null && { totalBudgetUzs: BigInt(Math.round(totalBudgetUzs)) }),
        ...(productionCost != null && { productionCost: BigInt(Math.round(productionCost)) }),
        ...(resolvedTotalFinal != null && { totalFinal: BigInt(Math.round(resolvedTotalFinal)) }),
        ...(additionalAmount != null && { additionalAmount: BigInt(Math.round(additionalAmount)) }),
      },
    });
    return NextResponse.json(serializeCampaign(campaign), { status: 201 });
  } catch (err) {
    console.error('POST /api/campaigns failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
