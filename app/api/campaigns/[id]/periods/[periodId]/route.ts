import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';

const UpdatePeriodSchema = z.object({
  name: z.string().min(1).optional(),
  periodStart: z.string().transform(s => new Date(s)).optional(),
  periodEnd: z.string().transform(s => new Date(s)).optional(),
  totalBudgetUzs: z.number().nullable().optional(),
  productionCost: z.number().nullable().optional(),
  acRate: z.number().min(0).max(1).optional(),
  totalFinal: z.number().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { periodId } = await params;
  const body = await req.json();
  const parsed = UpdatePeriodSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });

  const { totalBudgetUzs, productionCost, acRate, totalFinal, ...rest } = parsed.data;

  const period = await prisma.campaignPeriod.update({
    where: { id: periodId },
    data: {
      ...rest,
      ...(totalBudgetUzs !== undefined && { totalBudgetUzs: totalBudgetUzs ? BigInt(Math.round(totalBudgetUzs)) : null }),
      ...(productionCost !== undefined && { productionCost: productionCost ? BigInt(Math.round(productionCost)) : null }),
      ...(acRate !== undefined && { acRate }),
      ...(totalFinal !== undefined && { totalFinal: totalFinal ? BigInt(Math.round(totalFinal)) : null }),
    },
  });

  return NextResponse.json({
    ...period,
    totalBudgetUzs: period.totalBudgetUzs ? Number(period.totalBudgetUzs) : null,
    productionCost: period.productionCost ? Number(period.productionCost) : null,
    totalFinal: period.totalFinal ? Number(period.totalFinal) : null,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { periodId } = await params;
  await prisma.campaignPeriod.delete({ where: { id: periodId } });
  return NextResponse.json({ ok: true });
}
