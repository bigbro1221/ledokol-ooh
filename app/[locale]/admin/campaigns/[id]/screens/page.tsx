import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { auth, isGoogleLinked } from '@/lib/auth';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ScreensTable, type ScreenRow } from '@/components/screens/screens-table';

export default async function CampaignScreensPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      splitByPeriods: true,
      client: { select: { name: true } },
      periods: { select: { id: true, name: true }, orderBy: { periodStart: 'asc' } },
    },
  });

  if (!campaign) notFound();

  const screens = await prisma.screen.findMany({
    where: { campaignId: id },
    select: {
      id: true,
      externalId: true,
      type: true,
      city: true,
      address: true,
      size: true,
      resolution: true,
      impressionsPerDay: true,
      photoUrl: true,
      lat: true,
      lng: true,
      pricing: {
        select: { periodId: true, priceUnit: true, priceDiscounted: true, priceTotal: true },
      },
      metrics: {
        select: { periodId: true, otsPlan: true, otsFact: true },
      },
    },
    orderBy: [{ city: 'asc' }, { address: 'asc' }],
  });

  const rows: ScreenRow[] = screens.map(s => {
    const totalOtsPlan = s.metrics.reduce((ms, m) => ms + (m.otsPlan || 0), 0);
    const totalOtsFact = s.metrics.reduce((ms, m) => ms + (m.otsFact || 0), 0);
    const price = s.pricing.reduce((sum, p) => {
      if (p.priceDiscounted) return sum + Number(p.priceDiscounted);
      if (p.priceTotal) return sum + Number(p.priceTotal);
      if (p.priceUnit) return sum + Number(p.priceUnit);
      return sum;
    }, 0);
    return {
      id: s.id,
      externalId: s.externalId,
      type: s.type,
      city: s.city.trim(),
      address: s.address,
      size: s.size,
      resolution: s.resolution,
      impressionsPerDay: s.impressionsPerDay,
      periodId: null,
      periodName: null,
      otsPlan: totalOtsPlan || null,
      otsFact: totalOtsFact || null,
      price: price || null,
      lat: s.lat,
      lng: s.lng,
      photoUrl: s.photoUrl,
    };
  });

  const localeVal = (locale === 'en' || locale === 'uz') ? locale : 'ru';

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/campaigns/${id}`}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-3)] hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
          </Link>
          <div>
            <p className="text-xs text-[var(--text-3)]">{campaign.client.name} / {campaign.name}</p>
            <h1 className="text-xl font-semibold">Поверхности</h1>
          </div>
        </div>
        <div className="text-sm text-[var(--text-3)]">{screens.length} записей</div>
      </div>

      <ScreensTable
        campaignId={id}
        locale={localeVal}
        screens={rows}
        periods={campaign.splitByPeriods ? campaign.periods : []}
        editable={true}
        uploadHref={`/${locale}/admin/campaigns/${id}/upload`}
      />
    </div>
  );
}
