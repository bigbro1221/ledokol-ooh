import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { ScreenType } from '@prisma/client';
import { requireAdmin } from '@/lib/api-auth';

interface ScreenData {
  type: ScreenType;
  city: string;
  address: string;
  size?: string | null;
  resolution?: string | null;
  impressionsPerDay?: number | null;
  externalId?: string | null;
  photoUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  priceUnit?: number | null;
  priceDiscounted?: number | null;
  priceTotal?: number | null;
  priceRub?: number | null;
  commissionPct?: number | null;
  agencyFeeAmt?: number | null;
  productionCost?: number | null;
  otsPlan?: number | null;
  ratingPlan?: number | null;
  otsFact?: number | null;
  ratingFact?: number | null;
  universe?: number | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

  const { id: campaignId } = await params;
  const body = await req.json() as {
    screens: ScreenData[];
    periodId?: string | null;
    minioKey?: string;
    yandexMapUrl?: string | null;
    totalBudgetUzs?: number | null;
    totalBudgetRub?: number | null;
  };

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  if (body.periodId) {
    const period = await prisma.campaignPeriod.findFirst({ where: { id: body.periodId, campaignId } });
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Delete existing metrics + pricing for this period slot before re-inserting.
      // Screens (physical) are preserved and reused across uploads.
      if (body.periodId) {
        await tx.screenMetrics.deleteMany({ where: { periodId: body.periodId } });
        await tx.screenPricing.deleteMany({ where: { periodId: body.periodId } });
        await tx.screen.deleteMany({
          where: { campaignId, metrics: { none: {} }, pricing: { none: {} } },
        });
      } else {
        // Mono upload: clear null-period metrics/pricing, then remove orphaned screens.
        await tx.screenMetrics.deleteMany({ where: { screen: { campaignId }, periodId: null } });
        await tx.screenPricing.deleteMany({ where: { screen: { campaignId }, periodId: null } });
        await tx.screen.deleteMany({
          where: { campaignId, metrics: { none: {} }, pricing: { none: {} } },
        });
      }

      for (const s of body.screens) {
        // Find or create physical screen by stable key (campaignId + city + address).
        // On re-upload, refresh mutable display fields but keep the same ID.
        const screen = await tx.screen.upsert({
          where: { campaignId_city_address: { campaignId, city: s.city, address: s.address } },
          create: {
            campaignId,
            externalId: s.externalId || null,
            type: s.type,
            city: s.city,
            address: s.address,
            size: s.size || null,
            resolution: s.resolution || null,
            impressionsPerDay: s.impressionsPerDay ? Math.round(s.impressionsPerDay) : null,
            photoUrl: s.photoUrl || null,
            lat: s.lat || null,
            lng: s.lng || null,
          },
          update: {
            externalId: s.externalId || null,
            type: s.type,
            size: s.size || null,
            resolution: s.resolution || null,
            impressionsPerDay: s.impressionsPerDay ? Math.round(s.impressionsPerDay) : null,
            photoUrl: s.photoUrl || null,
            lat: s.lat || null,
            lng: s.lng || null,
          },
        });

        await tx.screenMetrics.create({
          data: {
            screenId: screen.id,
            periodId: body.periodId || null,
            otsPlan: s.otsPlan ? Math.round(s.otsPlan) : null,
            ratingPlan: s.ratingPlan != null ? Number(s.ratingPlan.toFixed(4)) : null,
            otsFact: s.otsFact ? Math.round(s.otsFact) : null,
            ratingFact: s.ratingFact != null ? Number(s.ratingFact.toFixed(4)) : null,
            universe: s.universe ? Math.round(s.universe) : null,
            source: 'XLSX',
          },
        });

        if (s.priceUnit || s.priceDiscounted || s.priceTotal || s.priceRub || s.productionCost || s.agencyFeeAmt || s.commissionPct) {
          await tx.screenPricing.create({
            data: {
              screenId: screen.id,
              periodId: body.periodId || null,
              priceUnit: s.priceUnit ? BigInt(Math.round(s.priceUnit)) : null,
              priceDiscounted: s.priceDiscounted ? BigInt(Math.round(s.priceDiscounted)) : null,
              priceTotal: s.priceTotal ? BigInt(Math.round(s.priceTotal)) : null,
              priceRub: s.priceRub ? BigInt(Math.round(s.priceRub)) : null,
              commissionPct: s.commissionPct != null ? s.commissionPct : null,
              agencyFeeAmt: s.agencyFeeAmt ? BigInt(Math.round(s.agencyFeeAmt)) : null,
              productionCost: s.productionCost ? BigInt(Math.round(s.productionCost)) : null,
            },
          });
        }
      }

      if (body.periodId) {
        await tx.campaignPeriod.update({
          where: { id: body.periodId },
          data: { sourceFileUrl: body.minioKey || undefined },
        });
      } else {
        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            sourceFileUrl: body.minioKey || undefined,
            yandexMapUrl: body.yandexMapUrl || undefined,
            totalBudgetUzs: body.totalBudgetUzs ? BigInt(Math.round(body.totalBudgetUzs)) : undefined,
            totalBudgetRub: body.totalBudgetRub ? BigInt(Math.round(body.totalBudgetRub)) : undefined,
          },
        });
      }
    });

    const updated = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { screens: true } } },
    });

    return NextResponse.json({
      ok: true,
      campaign: updated ? {
        ...updated,
        totalBudgetUzs: updated.totalBudgetUzs ? Number(updated.totalBudgetUzs) : null,
        totalBudgetRub: updated.totalBudgetRub ? Number(updated.totalBudgetRub) : null,
      } : null,
    });
  } catch (err) {
    console.error('Upload confirm failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Transaction failed' },
      { status: 500 }
    );
  }
}
