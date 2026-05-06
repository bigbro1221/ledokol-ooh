import { prisma } from '@/lib/db';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardClient } from './dashboard-client';
import { CampaignsListView } from './campaigns-list';
import { getUserPreferences } from '@/lib/user-preferences';
import type { DateFormat } from '@/lib/format-period';
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
  searchParams: Promise<{ campaign?: string; city?: string; type?: string; periodFrom?: string; periodTo?: string; periods?: string }>;
}) {
  const { locale } = await params;
  const { campaign: campaignIdParam, city: cityFilter, type: typeFilter, periodFrom: periodFromParam, periodTo: periodToParam, periods: periodsParam } = await searchParams;

  function splitCsv(v: string | undefined): string[] {
    return (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
  }
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

  const cityValues = splitCsv(cityFilter);
  const typeValues = splitCsv(typeFilter);

  const screenWhere: { screenType?: { code: { in: string[] } }; city?: { in: string[] } } = {};
  if (typeValues.length > 0) screenWhere.screenType = { code: { in: typeValues } };
  if (cityValues.length > 0) screenWhere.city = { in: cityValues };

  const [campaign, prefs] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: selectedId },
      select: {
        id: true, name: true, status: true, periodStart: true, periodEnd: true,
        splitByPeriods: true, mediaType: true,
        totalBudgetUzs: true, heatmapUrl: true, reportsUrl: true, yandexMapUrl: true,
        client: { select: { name: true } },
        totalFinal: true,
        periods: {
          select: { id: true, name: true, totalBudgetUzs: true, totalFinal: true, periodStart: true, periodEnd: true },
          orderBy: { periodStart: 'asc' as const },
        },
        screens: {
          where: Object.keys(screenWhere).length > 0 ? screenWhere : undefined,
          select: {
            id: true, externalId: true, city: true, address: true,
            size: true, resolution: true, photoUrl: true, lat: true, lng: true,
            impressionsPerDay: true,
            screenType: { select: { code: true } },
            metrics: { select: { periodId: true, otsPlan: true, ratingPlan: true, otsFact: true, ratingFact: true } },
            pricing: { select: { periodId: true, priceUnit: true, priceDiscounted: true, priceTotal: true, agencyFeeAmt: true } },
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
    select: { id: true, name: true, fileKey: true, thumbnailKey: true, mimeType: true, kind: true, width: true, height: true, sizeBytes: true, durationSec: true },
  });
  const creatives = await Promise.all(creativeRows.map(async c => ({
    id: c.id,
    name: c.name,
    mimeType: c.mimeType,
    kind: c.kind,
    width: c.width,
    height: c.height,
    sizeBytes: Number(c.sizeBytes),
    durationSec: c.durationSec,
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

  // Multi-select periods: ?periods=id1,id2,id3. Falls back to legacy ?periodFrom/?periodTo.
  let selectedPeriodIds: string[] = splitCsv(periodsParam).filter(id => allPeriodIds.includes(id));
  if (selectedPeriodIds.length === 0 && (periodFromParam || periodToParam)) {
    const legacyFrom = periodFromParam && allPeriodIds.includes(periodFromParam) ? periodFromParam : null;
    const legacyTo = periodToParam && allPeriodIds.includes(periodToParam) ? periodToParam : null;
    const fIdx = legacyFrom ? allPeriodIds.indexOf(legacyFrom) : -1;
    const tIdx = legacyTo ? allPeriodIds.indexOf(legacyTo) : -1;
    if (fIdx >= 0 && tIdx >= 0) {
      selectedPeriodIds = allPeriodIds.slice(Math.min(fIdx, tIdx), Math.max(fIdx, tIdx) + 1);
    }
  }

  const rangeIds: Set<string> = new Set(selectedPeriodIds);
  const isFiltered = rangeIds.size > 0;

  // For the campaign title: show min-start → max-end of selected periods
  const selectedPeriods = isFiltered ? periodsWithData.filter(p => rangeIds.has(p.id)) : [];
  const displayPeriodStart = isFiltered
    ? selectedPeriods.reduce<Date>((min, p) => p.periodStart < min ? p.periodStart : min, selectedPeriods[0].periodStart)
    : null;
  const displayPeriodEnd = isFiltered
    ? selectedPeriods.reduce<Date>((max, p) => p.periodEnd > max ? p.periodEnd : max, selectedPeriods[0].periodEnd)
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

  // Total (unfiltered) screen count — used to scale campaign-level budget by
  // the share of screens that pass the active city/type filter.
  const totalCampaignScreens = await prisma.screen.count({ where: { campaignId: selectedId } });

  const totalScreens = campaign.screens.length;

  const totalOts = campaign.screens.reduce((s, sc) =>
    s + filterMetrics(sc.metrics).reduce((ms, m) => ms + (m.otsPlan || 0), 0), 0);
  const totalOtsFact = campaign.screens.reduce((s, sc) =>
    s + filterMetrics(sc.metrics).reduce((ms, m) => ms + (m.otsFact || 0), 0), 0);
  // Sum of fact ratings across filtered metrics — denominator of CPT факт.
  const totalRatingFact = campaign.screens.reduce((s, sc) =>
    s + filterMetrics(sc.metrics).reduce((ms, m) => ms + (m.ratingFact ? Number(m.ratingFact) : 0), 0), 0);

  // Σ screen.impressionsPerDay across filtered screens — drives the
  // "Сред. показов/день" cell. Only meaningful for SCREENS campaigns
  // (XLSX has the "Прогнозное кол-во выходов в сутки" column per screen);
  // OTHER_CARRIERS leaves this null and the cell hides.
  const totalImpressionsPerDay = campaign.mediaType === 'OTHER_CARRIERS'
    ? null
    : campaign.screens.reduce((s, sc) => s + (sc.impressionsPerDay ?? 0), 0);

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
  // Prefer per-period sum when splitByPeriods AND any period has a budget; otherwise
  // fall back to the campaign-level total (covers OTHER_CARRIERS, where pricing lives
  // on the Campaign entity rather than each period).
  const manualBudgetUnscaled = campaign.splitByPeriods && periodsBudgetSum > 0
    ? periodsBudgetSum
    : campaignBudget;
  // City/type filter doesn't reach the Campaign row — only the screens array.
  // Scale the campaign-level total by the share of screens that pass the filter
  // so the headline number tracks the visible subset. (When no filter is active,
  // ratio == 1 and this is a no-op.)
  const screenFilterRatio = totalCampaignScreens > 0
    ? totalScreens / totalCampaignScreens
    : 1;
  const manualBudget = manualBudgetUnscaled * screenFilterRatio;

  // CPT factor: amount-without-VAT ÷ Σ ratingFact. Source of "amount without
  // VAT" depends on the campaign type:
  //   - OTHER_CARRIERS: campaign.totalBudgetUzs is already "without VAT"
  //     by the new form contract (see /admin/campaigns form rename).
  //   - SCREENS: per-screen ScreenPricing has priceTotal (без АК и НДС) and
  //     agencyFeeAmt; their sum across filtered pricing rows = without VAT.
  let totalBudgetWithoutVat = 0;
  if (campaign.mediaType === 'OTHER_CARRIERS') {
    totalBudgetWithoutVat = campaign.totalBudgetUzs ? Number(campaign.totalBudgetUzs) * screenFilterRatio : 0;
  } else {
    totalBudgetWithoutVat = campaign.screens.reduce((s, sc) =>
      s + filterPricing(sc.pricing).reduce((ps, p) => {
        const base = p.priceTotal ? Number(p.priceTotal) : 0;
        const ak = p.agencyFeeAmt ? Number(p.agencyFeeAmt) : 0;
        return ps + base + ak;
      }, 0), 0);
  }
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
    const key = s.screenType.code;
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
        type: s.screenType.code,
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
      type: s.screenType.code,
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
      userRole={session.user.role}
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
      kpis={{ totalOtsPlan: totalOts, totalOtsFact, totalRatingFact, totalImpressionsPerDay, totalScreens, cities: cities.size, totalBudget, totalBudgetWithoutVat, formatBudget: fmt(totalBudget) }}
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
      availableTypes={Array.from(new Set(campaign.screens.map(s => s.screenType.code)))}
      filters={{ cities: cityValues, types: typeValues }}
      heatmapEmbedUrl={heatmapEmbedUrl}
      reportsUrl={campaign.reportsUrl}
      hasYandexMap={!!campaign.yandexMapUrl}
      periodsWithData={periodsWithData.map(p => ({ id: p.id, name: p.name }))}
      selectedPeriods={selectedPeriodIds}
      creatives={creatives}
    />
  );
}
