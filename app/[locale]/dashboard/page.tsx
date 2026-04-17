import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardClient } from './dashboard-client';
import type { ScreenType } from '@prisma/client';

const TYPE_LABELS: Record<string, string> = {
  LED: 'LED экраны', STATIC: 'Статика', STOP: 'LED остановки', AIRPORT: 'Аэропорт', BUS: 'Транспорт',
};

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
      splitByPeriods: true,
      totalBudgetUzs: true, totalBudgetRub: true, heatmapUrl: true,
      client: { select: { name: true } },
      periods: { select: { totalBudgetUzs: true } },
      screens: {
        where: Object.keys(screenWhere).length > 0 ? screenWhere : undefined,
        select: {
          id: true, externalId: true, type: true, city: true, address: true,
          size: true, resolution: true, photoUrl: true, lat: true, lng: true,
          metrics: { select: { otsPlan: true, ratingPlan: true, otsFact: true, ratingFact: true } },
          pricing: { select: { priceUnit: true, priceDiscounted: true, priceTotal: true } },
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
  const totalOts = campaign.screens.reduce((s, sc) => s + (sc.metrics?.otsPlan || 0), 0);
  const totalOtsFact = campaign.screens.reduce((s, sc) => s + (sc.metrics?.otsFact || 0), 0);

  // Budget resolution:
  // 1. For split-by-period campaigns: sum of manually-entered period.totalBudgetUzs
  // 2. For mono campaigns: campaign.totalBudgetUzs (from XLSX Total sheet)
  // 3. Fallback: sum of screen priceTotal/priceDiscounted/priceUnit
  const periodsBudgetSum = campaign.splitByPeriods
    ? campaign.periods.reduce((s, p) => s + (p.totalBudgetUzs ? Number(p.totalBudgetUzs) : 0), 0)
    : 0;
  const campaignBudget = campaign.totalBudgetUzs ? Number(campaign.totalBudgetUzs) : 0;
  // Resolved before screen fallback
  const manualBudget = campaign.splitByPeriods ? periodsBudgetSum : campaignBudget;
  const cities = new Set(campaign.screens.map(s => s.city.trim()));

  // Helper: effective price per screen (priceTotal > priceDiscounted > priceUnit)
  const screenPrice = (s: { pricing?: { priceTotal: bigint | null; priceDiscounted: bigint | null; priceUnit: bigint | null } | null }): number => {
    if (!s.pricing) return 0;
    if (s.pricing.priceTotal) return Number(s.pricing.priceTotal);
    if (s.pricing.priceDiscounted) return Number(s.pricing.priceDiscounted);
    if (s.pricing.priceUnit) return Number(s.pricing.priceUnit);
    return 0;
  };

  // By type: OTS plan, OTS fact, budget share, screens count
  const byTypeMap: Record<string, { plan: number; fact: number; budget: number; screens: number }> = {};
  for (const s of campaign.screens) {
    const key = s.type;
    if (!byTypeMap[key]) byTypeMap[key] = { plan: 0, fact: 0, budget: 0, screens: 0 };
    byTypeMap[key].plan   += s.metrics?.otsPlan || 0;
    byTypeMap[key].fact   += s.metrics?.otsFact || 0;
    byTypeMap[key].budget += screenPrice(s);
    byTypeMap[key].screens++;
  }

  // OTS donut by type (plan)
  const donutData = Object.entries(byTypeMap)
    .map(([t, v]) => ({ name: TYPE_LABELS[t] || t, value: v.plan }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // Plan-vs-fact by type
  const planVsFactByType = Object.entries(byTypeMap)
    .map(([t, v]) => ({ label: TYPE_LABELS[t] || t, plan: v.plan, fact: v.fact }))
    .filter(d => d.plan > 0)
    .sort((a, b) => b.plan - a.plan);

  // Budget share by type
  const budgetByType = Object.entries(byTypeMap)
    .map(([t, v]) => ({ name: TYPE_LABELS[t] || t, value: v.budget }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const totalBudgetFromScreens = budgetByType.reduce((s, d) => s + d.value, 0);
  // Final budget: manual entry wins; fall back to sum of screen pricing
  const totalBudget = manualBudget > 0 ? manualBudget : totalBudgetFromScreens;

  // By city: plan, fact, screens
  const byCityMap: Record<string, { plan: number; fact: number; screens: number }> = {};
  for (const s of campaign.screens) {
    const c = s.city.trim();
    if (!byCityMap[c]) byCityMap[c] = { plan: 0, fact: 0, screens: 0 };
    byCityMap[c].plan += s.metrics?.otsPlan || 0;
    byCityMap[c].fact += s.metrics?.otsFact || 0;
    byCityMap[c].screens++;
  }

  // CityBreakdown (legacy shape): city, screens, ots (plan)
  const cityBreakdown = Object.entries(byCityMap)
    .map(([city, d]) => ({ city, screens: d.screens, ots: d.plan }))
    .sort((a, b) => b.ots - a.ots);

  // Plan-vs-fact by city
  const planVsFactByCity = Object.entries(byCityMap)
    .map(([city, d]) => ({ label: city, plan: d.plan, fact: d.fact }))
    .filter(d => d.plan > 0)
    .sort((a, b) => b.plan - a.plan);

  // Top screens by plan OTS (still useful for identifying hotspots)
  const topScreens = campaign.screens
    .map(s => ({ address: s.address, ots: s.metrics?.otsPlan || 0 }))
    .filter(s => s.ots > 0)
    .sort((a, b) => b.ots - a.ots).slice(0, 10);

  const tableScreens = campaign.screens
    .map(s => ({ id: s.id, externalId: s.externalId, type: s.type, city: s.city.trim(), address: s.address, size: s.size, photoUrl: s.photoUrl, ots: s.metrics?.otsPlan || null }))
    .sort((a, b) => (b.ots || 0) - (a.ots || 0));

  const mapScreens = campaign.screens
    .filter(s => s.lat && s.lng)
    .map(s => ({ id: s.id, lat: s.lat!, lng: s.lng!, type: s.type, address: s.address, city: s.city.trim(), size: s.size, ots: s.metrics?.otsPlan || null, otsFact: s.metrics?.otsFact || null, photoUrl: s.photoUrl }));

  // Derive Foursquare Studio embed URL. Foursquare's embed format is:
  //   https://studio.foursquare.com/map/public/{id}/embed
  // Users typically paste the view URL (no /embed suffix), so we append it.
  // If the URL already ends with /embed (trailing slash optional), pass through.
  function toEmbedUrl(url: string): string {
    const stripped = url.replace(/\/+$/, '');
    if (stripped.endsWith('/embed')) return stripped;
    if (stripped.includes('/map/public/')) return `${stripped}/embed`;
    return url; // unknown format — let user paste whatever works
  }
  const heatmapEmbedUrl = campaign.heatmapUrl ? toEmbedUrl(campaign.heatmapUrl) : null;

  const fmt = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `${(n/1e6).toFixed(0)}M` : n.toLocaleString('ru-RU');
  const period = `${campaign.periodStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })} — ${campaign.periodEnd.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;

  return (
    <DashboardClient
      locale={locale}
      campaigns={allCampaigns}
      selectedCampaignId={selectedId}
      campaign={{ name: campaign.name, clientName: campaign.client.name, period, status: campaign.status }}
      kpis={{ totalOtsPlan: totalOts, totalOtsFact, totalScreens, cities: cities.size, totalBudget, formatBudget: fmt(totalBudget) }}
      donutData={donutData}
      budgetByType={budgetByType}
      totalBudgetFromScreens={totalBudgetFromScreens}
      planVsFactByCity={planVsFactByCity}
      planVsFactByType={planVsFactByType}
      topScreens={topScreens}
      tableScreens={tableScreens}
      mapScreens={mapScreens}
      cityBreakdown={cityBreakdown}
      allCities={allCities.map(c => c.city.trim())}
      filters={{ city: cityFilter || '', type: typeFilter || '' }}
      heatmapEmbedUrl={heatmapEmbedUrl}
    />
  );
}
