import { prisma } from '@/lib/db';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardClient } from './dashboard-client';
import { CampaignsListView } from './campaigns-list';
import { getUserPreferences } from '@/lib/user-preferences';
import type { DateFormat } from '@/lib/format-period';
import type { ScreenType } from '@prisma/client';
import type { ScreenRow } from '@/components/screens/screens-table';
import { getTranslations } from 'next-intl/server';
import { getFileUrl } from '@/lib/minio';

function screenPriceTotal(s: { pricing: { priceUnit: bigint | null; priceDiscounted: bigint | null; priceTotal: bigint | null }[] }): number {
  return s.pricing.reduce((sum, p) => {
    if (p.priceDiscounted) return sum + Number(p.priceDiscounted);
    if (p.priceTotal) return sum + Number(p.priceTotal);
    if (p.priceUnit) return sum + Number(p.priceUnit);
    return sum;
  }, 0);
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ campaign?: string; city?: string; type?: string; periodFrom?: string; periodTo?: string }>;
}) {
  const { locale } = await params;
  const { campaign: campaignIdParam, city: cityFilter, type: typeFilter, periodFrom: periodFromParam, periodTo: periodToParam } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const td = await getTranslations({ locale, namespace: 'dashboard' });
  const tTypes = await getTranslations({ locale, namespace: 'screenTypes' });
  const TYPE_LABELS: Record<string, string> = {
    LED: tTypes('LEDscreens'),
    STATIC: tTypes('STATIC'),
    STOP: tTypes('STOPLed'),
    AIRPORT: tTypes('AIRPORT'),
    BUS: tTypes('BUS'),
  };

  const clientFilter = session.user.role === 'CLIENT' && session.user.clientId
    ? { client: { users: { some: { id: session.user.id } } } }
    : {};

  const allCampaigns = await prisma.campaign.findMany({
    where: { ...clientFilter, status: { not: 'DRAFT' } },
    select: { id: true, name: true, status: true, periodStart: true, periodEnd: true, client: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // List view: when no campaign is selected via ?campaign=…, render the
  // landing cards. We aggregate per-campaign stats (screens, OTS plan, budget)
  // for both the KPI strip and per-card stats.
  if (!campaignIdParam) {
    const aggCampaigns = await prisma.campaign.findMany({
      where: { ...clientFilter, status: { not: 'DRAFT' } },
      select: {
        id: true,
        name: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        totalFinal: true,
        totalBudgetUzs: true,
        splitByPeriods: true,
        periods: { select: { totalFinal: true, totalBudgetUzs: true } },
        _count: { select: { screens: true } },
        screens: {
          select: {
            metrics: { select: { otsPlan: true } },
            pricing: { select: { priceUnit: true, priceDiscounted: true, priceTotal: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const listPrefs = await getUserPreferences(session.user.id);
    const listDateFormat = listPrefs.dateFormat.toLowerCase() as DateFormat;
    const rows = aggCampaigns.map(c => {
      const otsPlan = c.screens.reduce(
        (sum, s) => sum + s.metrics.reduce((m, x) => m + (x.otsPlan ?? 0), 0),
        0,
      );
      let budget = 0;
      if (c.totalFinal) budget = Number(c.totalFinal);
      else if (c.splitByPeriods && c.periods.length > 0) {
        budget = c.periods.reduce((s, p) => s + Number(p.totalFinal ?? p.totalBudgetUzs ?? 0), 0);
      } else if (c.totalBudgetUzs) budget = Number(c.totalBudgetUzs);
      else budget = c.screens.reduce((s, sc) => s + screenPriceTotal(sc), 0);
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        budget,
        screensCount: c._count.screens,
        otsPlan,
      };
    });
    return <CampaignsListView rows={rows} locale={locale} dateFormat={listDateFormat} />;
  }

  const selectedId = allCampaigns.some(c => c.id === campaignIdParam) ? campaignIdParam : null;

  if (!selectedId) {
    // Invalid campaign id — redirect to the list view
    redirect(`/${locale}/dashboard`);
  }

  const screenWhere: { type?: ScreenType; city?: string } = {};
  if (typeFilter && ['LED','STATIC','STOP','AIRPORT','BUS'].includes(typeFilter)) {
    screenWhere.type = typeFilter as ScreenType;
  }
  if (cityFilter) screenWhere.city = cityFilter;

  const [campaign, prefs] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: selectedId },
      select: {
        id: true, name: true, status: true, periodStart: true, periodEnd: true,
        splitByPeriods: true,
        totalBudgetUzs: true, totalBudgetRub: true, heatmapUrl: true, reportsUrl: true,
        client: { select: { name: true } },
        totalFinal: true,
        periods: {
          select: { id: true, name: true, totalBudgetUzs: true, totalFinal: true, periodStart: true, periodEnd: true },
          orderBy: { periodStart: 'asc' as const },
        },
        screens: {
          where: Object.keys(screenWhere).length > 0 ? screenWhere : undefined,
          select: {
            id: true, externalId: true, type: true, city: true, address: true,
            size: true, resolution: true, photoUrl: true, lat: true, lng: true,
            impressionsPerDay: true,
            metrics: { select: { periodId: true, otsPlan: true, ratingPlan: true, otsFact: true, ratingFact: true } },
            pricing: { select: { periodId: true, priceUnit: true, priceDiscounted: true, priceTotal: true } },
          },
        },
      },
    }),
    getUserPreferences(session.user.id),
  ]);

  if (!campaign) redirect(`/${locale}/dashboard`);

  const initialDateFormat = prefs.dateFormat.toLowerCase() as DateFormat;

  const creativeRows = await prisma.creative.findMany({
    where: { campaignId: selectedId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, fileKey: true, thumbnailKey: true, mimeType: true, width: true, height: true, sizeBytes: true },
  });
  const creatives = await Promise.all(creativeRows.map(async c => ({
    id: c.id,
    name: c.name,
    mimeType: c.mimeType,
    width: c.width,
    height: c.height,
    sizeBytes: Number(c.sizeBytes),
    url: await getFileUrl(c.fileKey),
    thumbnailUrl: c.thumbnailKey ? await getFileUrl(c.thumbnailKey) : null,
  })));

  // Periods that have at least one metrics row with data
  const periodsWithData = campaign.splitByPeriods
    ? campaign.periods.filter(p =>
        campaign.screens.some(s => s.metrics.some(m => m.periodId === p.id))
      )
    : [];

  const allPeriodIds = periodsWithData.map(p => p.id);

  // Validate from/to against periods with data
  const selectedFrom = periodFromParam && allPeriodIds.includes(periodFromParam) ? periodFromParam : null;
  const selectedTo = periodToParam && allPeriodIds.includes(periodToParam) ? periodToParam : null;

  // Build the set of period IDs included in the selected range
  const fromIdx = selectedFrom ? allPeriodIds.indexOf(selectedFrom) : -1;
  const toIdx = selectedTo ? allPeriodIds.indexOf(selectedTo) : -1;
  const rangeIds: Set<string> = (fromIdx >= 0 && toIdx >= 0)
    ? new Set(allPeriodIds.slice(Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx) + 1))
    : new Set();

  const isFiltered = rangeIds.size > 0;

  // For the campaign title: show from-period start → to-period end when filtered
  const displayPeriodStart = isFiltered
    ? periodsWithData[Math.min(fromIdx, toIdx)].periodStart
    : null;
  const displayPeriodEnd = isFiltered
    ? periodsWithData[Math.max(fromIdx, toIdx)].periodEnd
    : null;

  // Filter helpers — only restrict when a range is active
  const filterMetrics = <T extends { periodId: string | null }>(metrics: T[]): T[] => {
    if (!isFiltered) return metrics;
    return metrics.filter(m => m.periodId && rangeIds.has(m.periodId));
  };

  const filterPricing = <T extends { periodId: string | null }>(pricing: T[]): T[] => {
    if (!isFiltered) return pricing;
    return pricing.filter(p => p.periodId && rangeIds.has(p.periodId));
  };

  const allCities = await prisma.screen.findMany({
    where: { campaignId: selectedId },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  });

  const totalScreens = campaign.screens.length;

  const totalOts = campaign.screens.reduce((s, sc) =>
    s + filterMetrics(sc.metrics).reduce((ms, m) => ms + (m.otsPlan || 0), 0), 0);
  const totalOtsFact = campaign.screens.reduce((s, sc) =>
    s + filterMetrics(sc.metrics).reduce((ms, m) => ms + (m.otsFact || 0), 0), 0);

  // Budget resolution — sum only periods within selected range (or all if no filter)
  const periodsBudgetSum = campaign.splitByPeriods
    ? campaign.periods
        .filter(p => !isFiltered || rangeIds.has(p.id))
        .reduce((s, p) => {
          const v = p.totalFinal ?? p.totalBudgetUzs;
          return s + (v ? Number(v) : 0);
        }, 0)
    : 0;
  const campaignBudget = campaign.totalFinal
    ? Number(campaign.totalFinal)
    : campaign.totalBudgetUzs ? Number(campaign.totalBudgetUzs) : 0;
  const manualBudget = campaign.splitByPeriods ? periodsBudgetSum : campaignBudget;
  const cities = new Set(campaign.screens.map(s => s.city.trim()));

  const screenTotalPrice = (s: { pricing: { periodId: string | null; priceUnit: bigint | null; priceDiscounted: bigint | null; priceTotal: bigint | null }[] }): number => {
    return filterPricing(s.pricing).reduce((sum, p) => {
      if (p.priceDiscounted) return sum + Number(p.priceDiscounted);
      if (p.priceTotal) return sum + Number(p.priceTotal);
      if (p.priceUnit) return sum + Number(p.priceUnit);
      return sum;
    }, 0);
  };

  const byTypeMap: Record<string, { plan: number; fact: number; budget: number; screens: number }> = {};
  for (const s of campaign.screens) {
    const key = s.type;
    if (!byTypeMap[key]) byTypeMap[key] = { plan: 0, fact: 0, budget: 0, screens: 0 };
    byTypeMap[key].plan   += filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsPlan || 0), 0);
    byTypeMap[key].fact   += filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsFact || 0), 0);
    byTypeMap[key].budget += screenTotalPrice(s);
    byTypeMap[key].screens++;
  }

  const planVsFactByType = Object.entries(byTypeMap)
    .map(([t, v]) => ({ label: TYPE_LABELS[t] || t, plan: v.plan, fact: v.fact }))
    .filter(d => d.plan > 0)
    .sort((a, b) => b.plan - a.plan);

  const budgetByType = Object.entries(byTypeMap)
    .map(([t, v]) => ({ name: TYPE_LABELS[t] || t, value: v.budget, count: v.screens }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const totalBudgetFromScreens = budgetByType.reduce((s, d) => s + d.value, 0);
  const totalBudget = manualBudget > 0 ? manualBudget : totalBudgetFromScreens;

  const byCityMap: Record<string, { plan: number; fact: number; screens: number }> = {};
  for (const s of campaign.screens) {
    const c = s.city.trim();
    if (!byCityMap[c]) byCityMap[c] = { plan: 0, fact: 0, screens: 0 };
    byCityMap[c].plan += filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsPlan || 0), 0);
    byCityMap[c].fact += filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsFact || 0), 0);
    byCityMap[c].screens++;
  }

  const cityBreakdown = Object.entries(byCityMap)
    .map(([city, d]) => ({ city, screens: d.screens, ots: d.plan }))
    .sort((a, b) => b.ots - a.ots);

  const planVsFactByCity = Object.entries(byCityMap)
    .map(([city, d]) => ({ label: city, plan: d.plan, fact: d.fact }))
    .filter(d => d.plan > 0)
    .sort((a, b) => b.plan - a.plan);

  // Monthly breakdown always uses all metrics regardless of period filter
  const monthlyByCity: { city: string; months: { label: string; plan: number; fact: number }[] }[] = [];
  if (campaign.splitByPeriods && campaign.periods.length > 0) {
    const map: Record<string, Record<string, { plan: number; fact: number }>> = {};
    for (const s of campaign.screens) {
      const city = s.city.trim();
      for (const m of s.metrics) {
        if (!m.periodId) continue;
        if (!map[city]) map[city] = {};
        if (!map[city][m.periodId]) map[city][m.periodId] = { plan: 0, fact: 0 };
        map[city][m.periodId].plan += m.otsPlan || 0;
        map[city][m.periodId].fact += m.otsFact || 0;
      }
    }
    for (const [city, periodData] of Object.entries(map)) {
      const months = campaign.periods
        .filter(p => periodData[p.id] && (periodData[p.id].plan > 0 || periodData[p.id].fact > 0))
        .map(p => ({ label: p.name, plan: periodData[p.id].plan, fact: periodData[p.id].fact }));
      if (months.length > 0) monthlyByCity.push({ city, months });
    }
    monthlyByCity.sort((a, b) =>
      b.months.reduce((s, m) => s + m.plan, 0) - a.months.reduce((s, m) => s + m.plan, 0)
    );
  }

  const topScreens = campaign.screens
    .map(s => ({ address: s.address, ots: filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsPlan || 0), 0) }))
    .filter(s => s.ots > 0)
    .sort((a, b) => b.ots - a.ots).slice(0, 20);

  const tableScreens: ScreenRow[] = campaign.screens
    .map(s => {
      const totalOtsPlan = filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsPlan || 0), 0);
      const totalOtsFact = filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsFact || 0), 0);
      const price = screenTotalPrice(s);
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
    })
    .sort((a, b) => (b.otsPlan ?? 0) - (a.otsPlan ?? 0));

  const campaignPeriods = campaign.splitByPeriods
    ? campaign.periods.map(p => ({ id: p.id, name: p.name }))
    : [];

  const mapScreens = campaign.screens
    .filter(s => s.lat && s.lng)
    .map(s => ({
      id: s.id,
      lat: s.lat!,
      lng: s.lng!,
      type: s.type,
      address: s.address,
      city: s.city.trim(),
      size: s.size,
      ots: filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsPlan || 0), 0) || null,
      otsFact: filterMetrics(s.metrics).reduce((ms, m) => ms + (m.otsFact || 0), 0) || null,
      photoUrl: s.photoUrl,
    }));

  function toEmbedUrl(url: string): string {
    const stripped = url.replace(/\/+$/, '');
    if (stripped.endsWith('/embed')) return stripped;
    if (stripped.includes('/map/public/')) return `${stripped}/embed`;
    return url;
  }
  const heatmapEmbedUrl = campaign.heatmapUrl ? toEmbedUrl(campaign.heatmapUrl) : null;

  const fmt = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `${(n/1e6).toFixed(0)}M` : n.toLocaleString('ru-RU');

  return (
    <DashboardClient
      locale={locale}
      campaigns={allCampaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        clientName: c.client.name,
        periodStart: c.periodStart.toISOString(),
        periodEnd: c.periodEnd.toISOString(),
      }))}
      selectedCampaignId={selectedId}
      initialDateFormat={initialDateFormat}
      campaign={{
        name: campaign.name,
        clientName: campaign.client.name,
        periodStart: displayPeriodStart ? displayPeriodStart.toISOString() : campaign.periodStart.toISOString(),
        periodEnd: displayPeriodEnd ? displayPeriodEnd.toISOString() : campaign.periodEnd.toISOString(),
        status: campaign.status,
      }}
      kpis={{ totalOtsPlan: totalOts, totalOtsFact, totalScreens, cities: cities.size, totalBudget, formatBudget: fmt(totalBudget) }}
      budgetByType={budgetByType}
      totalBudgetFromScreens={totalBudgetFromScreens}
      planVsFactByCity={planVsFactByCity}
      monthlyByCity={monthlyByCity}
      planVsFactByType={planVsFactByType}
      topScreens={topScreens}
      tableScreens={tableScreens}
      campaignPeriods={campaignPeriods}
      mapScreens={mapScreens}
      cityBreakdown={cityBreakdown}
      allCities={allCities.map(c => c.city.trim())}
      availableTypes={Array.from(new Set(campaign.screens.map(s => s.type)))}
      filters={{ city: cityFilter || '', type: typeFilter || '' }}
      heatmapEmbedUrl={heatmapEmbedUrl}
      reportsUrl={campaign.reportsUrl}
      periodsWithData={periodsWithData.map(p => ({ id: p.id, name: p.name }))}
      selectedFrom={selectedFrom}
      selectedTo={selectedTo}
      creatives={creatives}
    />
  );
}
