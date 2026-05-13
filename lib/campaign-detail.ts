import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

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
