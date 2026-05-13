import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { getFileUrl } from '@/lib/minio';

type CampaignDetailSelect = ReturnType<typeof buildSelect>;
type CampaignDetailReturn = Prisma.CampaignGetPayload<{ select: CampaignDetailSelect }>;

function buildSelect(screenWhere: Prisma.ScreenWhereInput | undefined) {
  return {
    id: true, name: true, status: true,
    periodStart: true, periodEnd: true,
    splitByPeriods: true, mediaType: true,
    totalBudgetUzs: true, totalFinal: true,
    heatmapUrl: true, reportsUrl: true, yandexMapUrl: true,
    targetAudience: true,
    client: { select: { name: true } },
    periods: {
      select: { id: true, name: true, totalBudgetUzs: true, totalFinal: true, periodStart: true, periodEnd: true },
      orderBy: { periodStart: 'asc' as const },
    },
    reachEntries: {
      select: { id: true, n: true, plan: true, fact: true, pinned: true },
      orderBy: { n: 'asc' as const },
    },
    screens: {
      where: screenWhere && Object.keys(screenWhere).length > 0 ? screenWhere : undefined,
      select: {
        id: true, externalId: true, city: true, address: true,
        resolution: true, photoUrl: true, lat: true, lng: true,
        screenType: { select: { code: true } },
        metrics: {
          select: {
            periodId: true,
            size: true,
            impressionsPerDay: true,
            otsPlan: true, ratingPlan: true, otsFact: true, ratingFact: true,
          },
        },
        pricing: { select: { periodId: true, priceUnit: true, priceDiscounted: true, priceTotal: true, agencyFeeAmt: true } },
      },
    },
  } as const;
}

/**
 * Loads a campaign with everything dashboard + print routes need.
 * Returns null if the campaign doesn't exist or the user can't access it.
 *
 * Pass `screenWhere` to apply URL-filter-style screen scoping (city / type /
 * period). Pass `undefined` to fetch all screens unfiltered.
 */
export async function getCampaignForDashboard(
  campaignId: string,
  userScope: { clientFilter: Prisma.CampaignWhereInput },
  screenWhere?: Prisma.ScreenWhereInput,
): Promise<CampaignDetailReturn | null> {
  return prisma.campaign.findFirst({
    where: { id: campaignId, ...userScope.clientFilter },
    select: buildSelect(screenWhere),
  });
}

export type DashboardCampaign = NonNullable<Awaited<ReturnType<typeof getCampaignForDashboard>>>;

export function pickLatest<T>(vals: (T | null)[]): T | null {
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) return vals[i];
  return null;
}

// Structurally typed so callers with a narrower Prisma select (e.g. list-view
// aggregation that only selects pricing.{priceUnit,priceDiscounted,priceTotal})
// can pass their rows directly. A full Screen is structurally compatible.
export function screenPriceTotal(s: {
  pricing: { priceUnit: bigint | null; priceDiscounted: bigint | null; priceTotal: bigint | null }[];
}): number {
  return s.pricing.reduce((sum, p) => {
    if (p.priceDiscounted) return sum + Number(p.priceDiscounted);
    if (p.priceTotal)      return sum + Number(p.priceTotal);
    if (p.priceUnit)       return sum + Number(p.priceUnit);
    return sum;
  }, 0);
}

export function totalsForCampaign(c: DashboardCampaign): {
  totalBudget: number; totalScreens: number; otsPlan: number; otsFact: number;
} {
  const totalScreens = c.screens.length;
  const otsPlan = c.screens.reduce((sum, s) => sum + s.metrics.reduce((m, x) => m + (x.otsPlan ?? 0), 0), 0);
  const otsFact = c.screens.reduce((sum, s) => sum + s.metrics.reduce((m, x) => m + (x.otsFact ?? 0), 0), 0);
  const totalBudget = c.screens.reduce((sum, s) => sum + screenPriceTotal(s), 0);
  return { totalBudget, totalScreens, otsPlan, otsFact };
}

// ---------------------------------------------------------------------------
// Row-shape builders shared by the dashboard and the print/PDF route. These
// always operate on the WHOLE campaign — they intentionally do NOT honour the
// dashboard's URL filters (city / type / selected periods). Callers that need
// filtering should pass a pre-filtered campaign via the `screenWhere` arg of
// `getCampaignForDashboard`, or filter the resulting rows themselves.
// ---------------------------------------------------------------------------

/**
 * Flat per-period plan/fact totals across the whole campaign. Returns one row
 * per `CampaignPeriod` (in chronological order, as stored on the campaign).
 * Periods with no recorded plan or fact are omitted.
 */
export function buildMonthlyRows(c: DashboardCampaign): { label: string; plan: number; fact: number }[] {
  if (!c.splitByPeriods || c.periods.length === 0) return [];
  const totals: Record<string, { plan: number; fact: number }> = {};
  for (const s of c.screens) {
    for (const m of s.metrics) {
      if (!m.periodId) continue;
      if (!totals[m.periodId]) totals[m.periodId] = { plan: 0, fact: 0 };
      totals[m.periodId].plan += m.otsPlan ?? 0;
      totals[m.periodId].fact += m.otsFact ?? 0;
    }
  }
  return c.periods
    .filter(p => totals[p.id] && (totals[p.id].plan > 0 || totals[p.id].fact > 0))
    .map(p => ({ label: p.name, plan: totals[p.id].plan, fact: totals[p.id].fact }));
}

/**
 * Plan/Fact totals grouped by screen type code. Pass `typeLabels` to translate
 * the raw codes (LED, STATIC, …) into human labels; omit to get the raw codes
 * as `name`. Result is sorted by plan desc and rows with `plan === 0` filtered.
 */
export function buildPlanFactByType(
  c: DashboardCampaign,
  typeLabels?: Record<string, string>,
): { name: string; plan: number; fact: number }[] {
  const map: Record<string, { plan: number; fact: number }> = {};
  for (const s of c.screens) {
    const key = s.screenType.code;
    if (!map[key]) map[key] = { plan: 0, fact: 0 };
    map[key].plan += s.metrics.reduce((ms, m) => ms + (m.otsPlan ?? 0), 0);
    map[key].fact += s.metrics.reduce((ms, m) => ms + (m.otsFact ?? 0), 0);
  }
  return Object.entries(map)
    .map(([code, v]) => ({ name: typeLabels?.[code] ?? code, plan: v.plan, fact: v.fact }))
    .filter(d => d.plan > 0)
    .sort((a, b) => b.plan - a.plan);
}

/**
 * City rows sorted by OTS plan desc.
 */
export function buildCityRows(c: DashboardCampaign): { city: string; screens: number; ots: number }[] {
  const map: Record<string, { screens: number; ots: number }> = {};
  for (const s of c.screens) {
    const city = s.city.trim();
    if (!map[city]) map[city] = { screens: 0, ots: 0 };
    map[city].screens++;
    map[city].ots += s.metrics.reduce((ms, m) => ms + (m.otsPlan ?? 0), 0);
  }
  return Object.entries(map)
    .map(([city, d]) => ({ city, screens: d.screens, ots: d.ots }))
    .sort((a, b) => b.ots - a.ots);
}

/**
 * Donut slices grouped by screen type, weighted by total OTS plan. Pass
 * `typeLabels` to translate codes into human labels.
 */
export function buildTypeSlices(
  c: DashboardCampaign,
  typeLabels?: Record<string, string>,
): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  for (const s of c.screens) {
    const code = s.screenType.code;
    const ots = s.metrics.reduce((ms, m) => ms + (m.otsPlan ?? 0), 0);
    map[code] = (map[code] ?? 0) + ots;
  }
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([code, v]) => ({ name: typeLabels?.[code] ?? code, value: v }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Loads creatives for a campaign, projecting MinIO file keys to public-facing
 * URLs. Shared by the dashboard and the print/PDF route so both see the same
 * field set.
 */
export async function loadCreatives(campaignId: string) {
  const rows = await prisma.creative.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, fileKey: true, thumbnailKey: true, mimeType: true, kind: true, width: true, height: true, sizeBytes: true, durationSec: true },
  });
  return Promise.all(rows.map(async c => ({
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
}

/**
 * Top N screens by OTS plan (desc). Screens with zero plan are dropped.
 */
export function buildTopScreens(
  c: DashboardCampaign,
  limit = 10,
): { address: string; ots: number }[] {
  return c.screens
    .map(s => ({ address: s.address, ots: s.metrics.reduce((ms, m) => ms + (m.otsPlan ?? 0), 0) }))
    .filter(s => s.ots > 0)
    .sort((a, b) => b.ots - a.ots)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Print-focused aggregators. These intentionally do NOT honour dashboard URL
// filters — print routes always export the whole campaign.
// ---------------------------------------------------------------------------

/** Distinct (trimmed) city count across all screens. */
export function citiesCount(c: DashboardCampaign): number {
  return new Set(c.screens.map(s => s.city.trim())).size;
}

/**
 * Headline budget "including AK & VAT". Mirrors the dashboard's manualBudget
 * resolution but without filter scaling.
 *   1. campaign.totalFinal           (campaign-level override wins)
 *   2. Σ periods[].totalFinal ?? totalBudgetUzs
 *   3. Σ screenPriceTotal(screen)    (fallback — what the spreadsheet says)
 */
export function budgetWithFees(c: DashboardCampaign): number {
  if (c.totalFinal) return Number(c.totalFinal);
  const periodsSum = c.periods.reduce((s, p) => {
    if (p.totalFinal) return s + Number(p.totalFinal);
    if (p.totalBudgetUzs) return s + Number(p.totalBudgetUzs);
    return s;
  }, 0);
  if (periodsSum > 0) return periodsSum;
  return c.screens.reduce((s, sc) => s + screenPriceTotal(sc), 0);
}

/** Average OTS plan per surface. Returns 0 when there are no screens. */
export function avgOtsPerSurface(c: DashboardCampaign): number {
  const total = c.screens.reduce(
    (s, sc) => s + sc.metrics.reduce((m, x) => m + (x.otsPlan ?? 0), 0),
    0,
  );
  return c.screens.length > 0 ? total / c.screens.length : 0;
}

/**
 * Average daily impressions across screens that have a value. Picks the
 * latest non-null impressionsPerDay per screen (matches the dashboard's
 * "latest flight wins" rule, see app/[locale]/dashboard/page.tsx ~L208).
 */
export function avgImpressionsPerDay(c: DashboardCampaign): number | null {
  const perScreen: number[] = [];
  for (const sc of c.screens) {
    const vals = sc.metrics
      .map(m => m.impressionsPerDay)
      .filter((v): v is number => v != null && v > 0);
    if (vals.length > 0) perScreen.push(vals[vals.length - 1]);
  }
  if (perScreen.length === 0) return null;
  return Math.round(perScreen.reduce((s, v) => s + v, 0) / perScreen.length);
}

/**
 * CPT факт — cost-per-thousand on fact ratings. Returns null when there's no
 * fact rating recorded yet. Mirrors the SCREENS branch of the dashboard calc
 * (see app/[locale]/dashboard/page.tsx ~L252-268):
 *   budget without VAT = Σ (priceTotal + agencyFeeAmt)
 * For OTHER_CARRIERS campaigns the dashboard reads campaign.totalBudgetUzs;
 * since SCREENS is the dominant case for this print page we follow the same
 * priceTotal+agencyFeeAmt path for both. If a future OTHER_CARRIERS variant
 * needs distinct logic, branch on c.mediaType here.
 */
export function cptFact(c: DashboardCampaign): number | null {
  const totalRatingFact = c.screens.reduce(
    (s, sc) =>
      s + sc.metrics.reduce((m, x) => m + (x.ratingFact ? Number(x.ratingFact) : 0), 0),
    0,
  );
  if (totalRatingFact === 0) return null;
  const budgetWithoutVat = c.screens.reduce(
    (s, sc) =>
      s + sc.pricing.reduce((ps, p) => {
        const base = p.priceTotal ? Number(p.priceTotal) : 0;
        const ak = p.agencyFeeAmt ? Number(p.agencyFeeAmt) : 0;
        return ps + base + ak;
      }, 0),
    0,
  );
  return Math.round(budgetWithoutVat / totalRatingFact);
}

/**
 * Budget aggregated by screen type. Each row has the (optionally translated)
 * type label, total budget in UZS, and its share of the campaign total.
 * Sorted by budget desc.
 */
export function buildBudgetByType(
  c: DashboardCampaign,
  typeLabels?: Record<string, string>,
): { name: string; budget: number; share: number }[] {
  const byType: Record<string, number> = {};
  for (const sc of c.screens) {
    const code = sc.screenType.code;
    byType[code] = (byType[code] ?? 0) + screenPriceTotal(sc);
  }
  const total = Object.values(byType).reduce((s, v) => s + v, 0);
  return Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(([code, budget]) => ({
      name: typeLabels?.[code] ?? code,
      budget,
      share: total > 0 ? budget / total : 0,
    }))
    .sort((a, b) => b.budget - a.budget);
}

/**
 * Plan vs fact OTS aggregated per city. Sorted by plan desc.
 */
export function buildCityPlanFact(
  c: DashboardCampaign,
): { city: string; plan: number; fact: number }[] {
  const byCity: Record<string, { plan: number; fact: number }> = {};
  for (const sc of c.screens) {
    const city = sc.city.trim();
    if (!byCity[city]) byCity[city] = { plan: 0, fact: 0 };
    for (const m of sc.metrics) {
      byCity[city].plan += m.otsPlan ?? 0;
      byCity[city].fact += m.otsFact ?? 0;
    }
  }
  return Object.entries(byCity)
    .map(([city, v]) => ({ city, plan: v.plan, fact: v.fact }))
    .sort((a, b) => b.plan - a.plan);
}
