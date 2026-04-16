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
  priceRub?: number | null;
  productionCost?: number | null;
  ots?: number | null;
  rating?: number | null;
  universe?: number | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

  const { id: campaignId } = await params;
  const body = await req.json() as {
    screens: ScreenData[];
    minioKey?: string;
    yandexMapUrl?: string | null;
    totalBudgetUzs?: number | null;
    totalBudgetRub?: number | null;
  };

  // Verify campaign exists
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Transactional: delete existing screens, insert new ones, update campaign
  try {
    await prisma.$transaction(async (tx) => {
      // Clear existing screens
      await tx.screen.deleteMany({ where: { campaignId } });

      // Insert all screens
      for (const s of body.screens) {
        await tx.screen.create({
          data: {
            campaignId,
            externalId: s.externalId || null,
            type: s.type,
            city: s.city,
            address: s.address,
            size: s.size || null,
            resolution: s.resolution || null,
            photoUrl: s.photoUrl || null,
            lat: s.lat || null,
            lng: s.lng || null,
            pricing: (s.priceUnit || s.priceDiscounted || s.priceRub || s.productionCost)
              ? {
                  create: {
                    priceUnit: s.priceUnit ? BigInt(Math.round(s.priceUnit)) : null,
                    priceDiscounted: s.priceDiscounted ? BigInt(Math.round(s.priceDiscounted)) : null,
                    priceRub: s.priceRub ? BigInt(Math.round(s.priceRub)) : null,
                    productionCost: s.productionCost ? BigInt(Math.round(s.productionCost)) : null,
                  },
                }
              : undefined,
            metrics: {
              create: {
                ots: s.ots ? Math.round(s.ots) : null,
                rating: s.rating ? Number(s.rating.toFixed(2)) : null,
                universe: s.universe ? Math.round(s.universe) : null,
                source: 'XLSX',
              },
            },
          },
        });
      }

      // Update campaign metadata
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          sourceFileUrl: body.minioKey || undefined,
          yandexMapUrl: body.yandexMapUrl || undefined,
          totalBudgetUzs: body.totalBudgetUzs ? BigInt(Math.round(body.totalBudgetUzs)) : undefined,
          totalBudgetRub: body.totalBudgetRub ? BigInt(Math.round(body.totalBudgetRub)) : undefined,
        },
      });
    });

    const updated = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { screens: true } } },
    });

    // BigInt can't be serialized to JSON — convert to number
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
