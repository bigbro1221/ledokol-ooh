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

  // If periodId provided, verify it belongs to this campaign
  if (body.periodId) {
    const period = await prisma.campaignPeriod.findFirst({ where: { id: body.periodId, campaignId } });
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (body.periodId) {
        // Period upload: delete only screens for this period, then insert new ones
        await tx.screen.deleteMany({ where: { campaignId, periodId: body.periodId } });
      } else {
        // Mono campaign upload: delete all screens (no periodId), then insert new ones
        await tx.screen.deleteMany({ where: { campaignId, periodId: null } });
      }

      for (const s of body.screens) {
        await tx.screen.create({
          data: {
            campaignId,
            periodId: body.periodId || null,
            externalId: s.externalId || null,
            type: s.type,
            city: s.city,
            address: s.address,
            size: s.size || null,
            resolution: s.resolution || null,
            photoUrl: s.photoUrl || null,
            lat: s.lat || null,
            lng: s.lng || null,
            pricing: (s.priceUnit || s.priceDiscounted || s.priceTotal || s.priceRub || s.productionCost || s.agencyFeeAmt || s.commissionPct)
              ? {
                  create: {
                    priceUnit: s.priceUnit ? BigInt(Math.round(s.priceUnit)) : null,
                    priceDiscounted: s.priceDiscounted ? BigInt(Math.round(s.priceDiscounted)) : null,
                    priceTotal: s.priceTotal ? BigInt(Math.round(s.priceTotal)) : null,
                    priceRub: s.priceRub ? BigInt(Math.round(s.priceRub)) : null,
                    commissionPct: s.commissionPct != null ? s.commissionPct : null,
                    agencyFeeAmt: s.agencyFeeAmt ? BigInt(Math.round(s.agencyFeeAmt)) : null,
                    productionCost: s.productionCost ? BigInt(Math.round(s.productionCost)) : null,
                  },
                }
              : undefined,
            metrics: {
              create: {
                otsPlan: s.otsPlan ? Math.round(s.otsPlan) : null,
                ratingPlan: s.ratingPlan != null ? Number(s.ratingPlan.toFixed(4)) : null,
                otsFact: s.otsFact ? Math.round(s.otsFact) : null,
                ratingFact: s.ratingFact != null ? Number(s.ratingFact.toFixed(4)) : null,
                universe: s.universe ? Math.round(s.universe) : null,
                source: 'XLSX',
              },
            },
          },
        });
      }

      if (body.periodId) {
        // Update period's sourceFileUrl
        await tx.campaignPeriod.update({
          where: { id: body.periodId },
          data: { sourceFileUrl: body.minioKey || undefined },
        });
      } else {
        // Mono campaign: update campaign metadata
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
