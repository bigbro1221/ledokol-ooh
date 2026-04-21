import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';

const CreatePeriodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  periodStart: z.string().transform(s => new Date(s)),
  periodEnd: z.string().transform(s => new Date(s)),
  totalBudgetUzs: z.number().nullable().optional(),
  productionCost: z.number().nullable().optional(),
  acRate: z.number().min(0).max(1).optional().default(0),
  totalFinal: z.number().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: campaignId } = await params;
  const periods = await prisma.campaignPeriod.findMany({
    where: { campaignId },
    include: { _count: { select: { metrics: true } } },
    orderBy: { periodStart: 'asc' },
  });

  return NextResponse.json(periods.map(p => ({
    ...p,
    totalBudgetUzs: p.totalBudgetUzs ? Number(p.totalBudgetUzs) : null,
    productionCost: p.productionCost ? Number(p.productionCost) : null,
    totalFinal: p.totalFinal ? Number(p.totalFinal) : null,
  })));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!campaign.splitByPeriods) return NextResponse.json({ error: 'Campaign is not split by periods' }, { status: 400 });

  const body = await req.json();
  const parsed = CreatePeriodSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });

  const { totalBudgetUzs, productionCost, acRate, totalFinal, ...rest } = parsed.data;

  const period = await prisma.campaignPeriod.create({
    data: {
      ...rest,
      campaignId,
      totalBudgetUzs: totalBudgetUzs ? BigInt(Math.round(totalBudgetUzs)) : null,
      productionCost: productionCost ? BigInt(Math.round(productionCost)) : null,
      acRate: acRate ?? 0,
      totalFinal: totalFinal ? BigInt(Math.round(totalFinal)) : null,
    },
  });

  return NextResponse.json({
    ...period,
    totalBudgetUzs: period.totalBudgetUzs ? Number(period.totalBudgetUzs) : null,
    productionCost: period.productionCost ? Number(period.productionCost) : null,
    totalFinal: period.totalFinal ? Number(period.totalFinal) : null,
  }, { status: 201 });
}
