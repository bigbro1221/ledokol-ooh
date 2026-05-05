import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MediaType } from '@prisma/client';
import { requireAdmin } from '@/lib/api-auth';
import { serializeCampaign } from '@/lib/serializers';

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  periodStart: z.string().transform(s => new Date(s)).optional(),
  periodEnd: z.string().transform(s => new Date(s)).optional(),
  splitByPeriods: z.boolean().optional(),
  heatmapUrl: z.string().url().optional().nullable(),
  yandexMapUrl: z.string().url().optional().nullable(),
  reportsUrl: z.string().url().optional().nullable(),
  totalBudgetUzs: z.number().nullable().optional(),
  productionCost: z.number().nullable().optional(),
  acRate: z.number().min(0).max(1).optional(),
  totalFinal: z.number().nullable().optional(),
  mediaType: z.nativeEnum(MediaType).optional(),
  additionalCurrency: z.string().trim().min(1).nullable().optional(),
  additionalAmount: z.number().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: true,
      _count: { select: { screens: true } },
    },
  });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(serializeCampaign(campaign));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.mediaType) {
    const existing = await prisma.campaign.findUnique({
      where: { id },
      select: {
        mediaType: true,
        totalBudgetUzs: true,
        productionCost: true,
        totalFinal: true,
        additionalAmount: true,
        _count: { select: { periods: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (parsed.data.mediaType !== existing.mediaType) {
      const hasFinancials =
        existing.totalBudgetUzs != null ||
        existing.productionCost != null ||
        existing.totalFinal != null ||
        existing.additionalAmount != null;
      if (existing._count.periods > 0 || hasFinancials) {
        return NextResponse.json(
          {
            error: 'mediaType_locked',
            message: 'Очистите периоды и финансовые данные перед сменой типа кампании',
          },
          { status: 409 },
        );
      }
    }
  }

  const { totalBudgetUzs, productionCost, totalFinal, acRate, additionalAmount, ...rest } = parsed.data;

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...rest,
      ...(acRate !== undefined && { acRate }),
      ...(totalBudgetUzs !== undefined && { totalBudgetUzs: totalBudgetUzs ? BigInt(Math.round(totalBudgetUzs)) : null }),
      ...(productionCost !== undefined && { productionCost: productionCost ? BigInt(Math.round(productionCost)) : null }),
      ...(totalFinal !== undefined && { totalFinal: totalFinal ? BigInt(Math.round(totalFinal)) : null }),
      ...(additionalAmount !== undefined && { additionalAmount: additionalAmount != null ? BigInt(Math.round(additionalAmount)) : null }),
    },
  });

  return NextResponse.json(serializeCampaign(campaign));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
