import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardClient } from './dashboard-client';
import type { ScreenType } from '@prisma/client';

function generateDailyImpressions(start: Date, end: Date, totalOts: number) {
  const days: { date: string; impressions: number }[] = [];
  const d = new Date(start);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const baseDaily = Math.round(totalOts / dayCount);
  while (d <= end) {
    const i = days.length;
    const ramp = Math.min(1, i / 7);
    const v = 0.85 + Math.sin(i * 1.3) * 0.15 + Math.cos(i * 0.7) * 0.1;
    days.push({ date: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, impressions: Math.round(baseDaily * ramp * v) });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function generateHourly(totalOts: number) {
  const w = [0.01,0.005,0.003,0.003,0.005,0.01,0.03,0.06,0.08,0.07,0.06,0.055,0.05,0.05,0.055,0.06,0.07,0.08,0.075,0.06,0.04,0.03,0.02,0.015];
  return w.map((wt, i) => ({ hour: String(i), impressions: Math.round(totalOts * wt) }));
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ campaign?: string; city?: string; type?: string }>;
}) {
  const { locale } = await params;
  const { campaign: campaignIdParam, city: cityFilter, type: typeFilter } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const clientFilter = session.user.role === 'CLIENT' && session.user.clientId
    ? { client: { users: { some: { id: session.user.id } } } }
    : {};

  const allCampaigns = await prisma.campaign.findMany({
    where: { ...clientFilter, status: { not: 'DRAFT' } },
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: 'desc' },
  });

  const selectedId = campaignIdParam && allCampaigns.some(c => c.id === campaignIdParam)
    ? campaignIdParam : allCampaigns[0]?.id;

  if (!selectedId) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <h2 className="text-[28px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>Нет кампаний</h2>
        <p className="mt-3 text-sm text-[var(--text-3)]">Команда Ledokol загрузит ваш первый медиаплан.</p>
      </div>
    );
  }

  // Build screen filter
  const screenWhere: { type?: ScreenType; city?: string } = {};
  if (typeFilter && ['LED','STATIC','STOP','AIRPORT','BUS'].includes(typeFilter)) {
    screenWhere.type = typeFilter as ScreenType;
  }
  if (cityFilter) screenWhere.city = cityFilter;

  const campaign = await prisma.campaign.findUnique({
    where: { id: selectedId },
    select: {
      id: true, name: true, status: true, periodStart: true, periodEnd: true,
      totalBudgetUzs: true, totalBudgetRub: true,
      client: { select: { name: true } },
      screens: {
        where: Object.keys(screenWhere).length > 0 ? screenWhere : undefined,
        select: {
          id: true, externalId: true, type: true, city: true, address: true,
          size: true, resolution: true, photoUrl: true, lat: true, lng: true,
          metrics: { select: { ots: true, rating: true } },
          pricing: { select: { priceUnit: true, priceDiscounted: true } },
        },
      },
    },
  });

  if (!campaign) redirect(`/${locale}/dashboard`);

  // Also get all cities for filter (unfiltered)
  const allCities = await prisma.screen.findMany({
    where: { campaignId: selectedId },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  });

  const totalScreens = campaign.screens.length;
  const totalOts = campaign.screens.reduce((s, sc) => s + (sc.metrics?.ots || 0), 0);
  const totalBudget = campaign.totalBudgetUzs ? Number(campaign.totalBudgetUzs) : 0;
  const cities = new Set(campaign.screens.map(s => s.city.trim()));

  // Donut by type
  const byType: Record<string, number> = {};
  for (const s of campaign.screens) { byType[s.type] = (byType[s.type] || 0) + (s.metrics?.ots || 0); }
  const tl: Record<string, string> = { LED: 'LED экраны', STATIC: 'Статика', STOP: 'LED остановки', AIRPORT: 'Аэропорт', BUS: 'Транспорт' };
  const donutData = Object.entries(byType).map(([t, v]) => ({ name: tl[t] || t, value: v })).sort((a, b) => b.value - a.value);

  // City breakdown
  const cityMap: Record<string, { screens: number; ots: number }> = {};
  for (const s of campaign.screens) {
    const c = s.city.trim();
    if (!cityMap[c]) cityMap[c] = { screens: 0, ots: 0 };
    cityMap[c].screens++;
    cityMap[c].ots += s.metrics?.ots || 0;
  }
  const cityBreakdown = Object.entries(cityMap)
    .map(([city, d]) => ({ city, ...d }))
    .sort((a, b) => b.ots - a.ots);

  // Top screens
  const topScreens = campaign.screens
    .map(s => ({ address: s.address, ots: s.metrics?.ots || 0 }))
    .sort((a, b) => b.ots - a.ots).slice(0, 10);

  const dailyImpressions = generateDailyImpressions(campaign.periodStart, campaign.periodEnd, totalOts || totalScreens * 6000);
  const hourlyData = generateHourly(totalOts || totalScreens * 6000);

  const tableScreens = campaign.screens
    .map(s => ({ id: s.id, externalId: s.externalId, type: s.type, city: s.city.trim(), address: s.address, size: s.size, photoUrl: s.photoUrl, ots: s.metrics?.ots || null }))
    .sort((a, b) => (b.ots || 0) - (a.ots || 0));

  const mapScreens = campaign.screens
    .filter(s => s.lat && s.lng)
    .map(s => ({ id: s.id, lat: s.lat!, lng: s.lng!, type: s.type, address: s.address, city: s.city.trim(), size: s.size, ots: s.metrics?.ots || null, photoUrl: s.photoUrl }));

  const fmt = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `${(n/1e6).toFixed(0)}M` : n.toLocaleString('ru-RU');
  const period = `${campaign.periodStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })} — ${campaign.periodEnd.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;

  return (
    <DashboardClient
      locale={locale}
      campaigns={allCampaigns}
      selectedCampaignId={selectedId}
      campaign={{ name: campaign.name, clientName: campaign.client.name, period, status: campaign.status }}
      kpis={{ totalOts: totalOts || totalScreens * 6000, totalScreens, cities: cities.size, totalBudget, formatBudget: fmt(totalBudget) }}
      donutData={donutData}
      dailyImpressions={dailyImpressions}
      hourlyData={hourlyData}
      topScreens={topScreens}
      tableScreens={tableScreens}
      mapScreens={mapScreens}
      cityBreakdown={cityBreakdown}
      allCities={allCities.map(c => c.city.trim())}
      filters={{ city: cityFilter || '', type: typeFilter || '' }}
    />
  );
}
