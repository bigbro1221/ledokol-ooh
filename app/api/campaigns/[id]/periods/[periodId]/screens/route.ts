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

  // Verify period belongs to this campaign
  const period = await prisma.campaignPeriod.findFirst({
    where: { id: periodId, campaignId },
  });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

  const { count } = await prisma.screen.deleteMany({ where: { periodId } });
  return NextResponse.json({ ok: true, deleted: count });
}
