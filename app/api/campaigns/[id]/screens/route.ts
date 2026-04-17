import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

/**
 * DELETE /api/campaigns/[id]/screens
 * Removes all screens (and their cascaded metrics/pricing) for a campaign.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Verify campaign exists
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { count } = await prisma.screen.deleteMany({ where: { campaignId: id } });

  return NextResponse.json({ ok: true, deleted: count });
}
