import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

/**
 * DELETE /api/campaigns/[id]/screens
 *
 * Removes upload-derived data from a campaign. Always deletes screens (and
 * their cascaded metrics/pricing). For OTHER_CARRIERS campaigns it also
 * deletes auto-created CampaignPeriod rows and resets splitByPeriods +
 * sourceFileUrl, since those all originate from the file rather than from
 * user input. SCREENS campaigns leave their periods alone — those are
 * user-managed via PeriodManager.
 *
 * The Campaign row's form fields (name, dates, mediaType, financials,
 * yandex/heatmap/reports URLs, currency) and Creative rows are preserved.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, mediaType: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const screens = await tx.screen.deleteMany({ where: { campaignId: id } });
    let periods = 0;
    if (campaign.mediaType === 'OTHER_CARRIERS') {
      const r = await tx.campaignPeriod.deleteMany({ where: { campaignId: id } });
      periods = r.count;
      await tx.campaign.update({
        where: { id },
        data: { splitByPeriods: false, sourceFileUrl: null },
      });
    }
    return { screens: screens.count, periods };
  });

  return NextResponse.json({ ok: true, ...result });
}
