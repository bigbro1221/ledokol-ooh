import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; periodId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: campaignId, periodId } = await params;

  const period = await prisma.campaignPeriod.findFirst({
    where: { id: periodId, campaignId },
  });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

  // Delete metrics + pricing for this period, then clean up orphaned screens
  const [metricsResult] = await prisma.$transaction([
    prisma.screenMetrics.deleteMany({ where: { periodId } }),
    prisma.screenPricing.deleteMany({ where: { periodId } }),
  ]);

  // Remove screens that now have no metrics and no pricing
  await prisma.screen.deleteMany({
    where: { campaignId, metrics: { none: {} }, pricing: { none: {} } },
  });

  return NextResponse.json({ ok: true, deleted: metricsResult.count });
}
