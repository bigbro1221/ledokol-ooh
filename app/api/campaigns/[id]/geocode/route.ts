import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { fetchYandexPins } from '@/lib/parser/yandex';
import { matchPinsToRows } from '@/lib/parser/matcher';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { yandexMapUrl: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!campaign.yandexMapUrl) return NextResponse.json({ error: 'No Yandex map URL set on this campaign' }, { status: 400 });

  const screens = await prisma.screen.findMany({
    where: { campaignId },
    select: { id: true, address: true },
  });
  if (screens.length === 0) return NextResponse.json({ matched: 0, total: 0 });

  const pins = await fetchYandexPins(campaign.yandexMapUrl);
  if (pins.length === 0) return NextResponse.json({ error: 'No pins found in Yandex map' }, { status: 422 });

  const { matched } = matchPinsToRows(pins, screens.map(s => s.address));

  let matchedCount = 0;
  for (const screen of screens) {
    const coords = matched.get(screen.address);
    if (coords) {
      await prisma.screen.update({
        where: { id: screen.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      matchedCount++;
    }
  }

  return NextResponse.json({ matched: matchedCount, total: screens.length });
}
