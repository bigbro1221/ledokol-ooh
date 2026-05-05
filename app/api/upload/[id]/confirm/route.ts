import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { LEGACY_ENUM_BY_CODE } from '@/lib/parser/sheets';
import type { Prisma } from '@prisma/client';

interface ScreenData {
  typeCode: string;
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

interface PeriodMetrics {
  periodStart: string; // ISO string
  periodEnd: string; // ISO string
  periodLabel: string;
  otsPlan: number | null;
  ratingPlan: number | null;
  otsFact: number | null;
  ratingFact: number | null;
  universe: number | null;
}

interface MultiPeriodScreenData {
  typeCode: string;
  city: string;
  address: string;
  size?: string | null;
  resolution?: string | null;
  impressionsPerDay?: number | null;
  externalId?: string | null;
  photoUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  metrics: PeriodMetrics[];
}

type ScreensModeBody = {
  mode?: 'screens';
  screens: ScreenData[];
  periodId?: string | null;
  minioKey?: string;
  yandexMapUrl?: string | null;
  totalBudgetUzs?: number | null;
  totalBudgetRub?: number | null;
};

type MultiPeriodBody = {
  mode: 'multi-period';
  screens: MultiPeriodScreenData[];
  minioKey?: string;
  yandexMapUrl?: string | null;
};

type ConfirmBody = ScreensModeBody | MultiPeriodBody;

// Common fields needed to upsert a Screen — shared between modes.
type UpsertableScreen = Pick<
  ScreenData,
  'typeCode' | 'city' | 'address' | 'externalId' | 'size' | 'resolution' | 'impressionsPerDay' | 'photoUrl' | 'lat' | 'lng'
>;

function buildScreenWriteData(s: UpsertableScreen, typeIdByCode: Map<string, string>) {
  return {
    externalId: s.externalId || null,
    type: LEGACY_ENUM_BY_CODE[s.typeCode] ?? 'STATIC',
    typeId: typeIdByCode.get(s.typeCode) ?? null,
    size: s.size || null,
    resolution: s.resolution || null,
    impressionsPerDay: s.impressionsPerDay ? Math.round(s.impressionsPerDay) : null,
    photoUrl: s.photoUrl || null,
    lat: s.lat || null,
    lng: s.lng || null,
  } as const;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return authResult.response;

  const { id: campaignId } = await params;
  const body = (await req.json()) as ConfirmBody;
  const mode = body.mode ?? 'screens';

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Pre-flight period existence check for screens mode (preserves the previous 404 contract).
  if (body.mode !== 'multi-period' && body.periodId) {
    const period = await prisma.campaignPeriod.findFirst({
      where: { id: body.periodId, campaignId },
    });
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  }

  try {
    if (body.mode === 'multi-period') {
      await handleMultiPeriodConfirm(campaignId, body);
    } else {
      await handleScreensConfirm(campaignId, body);
    }

    const updated = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { screens: true } } },
    });

    return NextResponse.json({
      ok: true,
      campaign: updated
        ? {
            ...updated,
            totalBudgetUzs: updated.totalBudgetUzs ? Number(updated.totalBudgetUzs) : null,
            totalBudgetRub: updated.totalBudgetRub ? Number(updated.totalBudgetRub) : null,
          }
        : null,
    });
  } catch (err) {
    console.error('Upload confirm failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Transaction failed' },
      { status: 500 }
    );
  }
}

async function handleScreensConfirm(campaignId: string, body: ScreensModeBody) {
  // Period existence is pre-checked in the main handler so it can return 404 cleanly.
  await prisma.$transaction(async (tx) => {
    // Resolve typeCode → typeId once for all rows in this payload.
    const codes = Array.from(new Set(body.screens.map((s) => s.typeCode)));
    const types = await tx.screenTypeRef.findMany({ where: { code: { in: codes } } });
    const typeIdByCode = new Map(types.map((t) => [t.code, t.id]));

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
      const data = buildScreenWriteData(s, typeIdByCode);
      const screen = await tx.screen.upsert({
        where: { campaignId_city_address: { campaignId, city: s.city, address: s.address } },
        create: { ...data, campaignId, city: s.city, address: s.address },
        update: data,
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

      if (
        s.priceUnit ||
        s.priceDiscounted ||
        s.priceTotal ||
        s.priceRub ||
        s.productionCost ||
        s.agencyFeeAmt ||
        s.commissionPct
      ) {
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
}

async function handleMultiPeriodConfirm(campaignId: string, body: MultiPeriodBody) {
  await prisma.$transaction(async (tx) => {
    // 1. Resolve typeCodes once.
    const codes = Array.from(new Set(body.screens.map((s) => s.typeCode)));
    const types = await tx.screenTypeRef.findMany({ where: { code: { in: codes } } });
    const typeIdByCode = new Map(types.map((t) => [t.code, t.id]));

    // 2. Wipe everything for this campaign — periods (with cascade), screens too.
    //    Multi-period uploads are full reseeds, not incremental.
    //    Cascade: CampaignPeriod onDelete cascades ScreenMetrics & ScreenPricing,
    //    but not Screens. Orphan-clean Screens whose metrics+pricing were nuked.
    await tx.campaignPeriod.deleteMany({ where: { campaignId } });
    await tx.screen.deleteMany({
      where: { campaignId, metrics: { none: {} }, pricing: { none: {} } },
    });

    // 3. Collect unique periods across all screens, create them once.
    const periodKey = (s: string, e: string) => `${s}_${e}`;
    const allPeriods = new Map<string, { start: Date; end: Date; label: string }>();
    for (const sc of body.screens) {
      for (const m of sc.metrics) {
        const k = periodKey(m.periodStart, m.periodEnd);
        if (!allPeriods.has(k)) {
          allPeriods.set(k, {
            start: new Date(m.periodStart),
            end: new Date(m.periodEnd),
            label: m.periodLabel,
          });
        }
      }
    }
    const periodIdByKey = new Map<string, string>();
    for (const [k, p] of Array.from(allPeriods.entries())) {
      const created = await tx.campaignPeriod.create({
        data: {
          campaignId,
          name: p.label,
          periodStart: p.start,
          periodEnd: p.end,
        },
      });
      periodIdByKey.set(k, created.id);
    }

    // 4. Update campaign date range, mark splitByPeriods.
    if (allPeriods.size > 0) {
      const periodsArr = Array.from(allPeriods.values());
      const minStart = new Date(Math.min(...periodsArr.map((p) => p.start.getTime())));
      const maxEnd = new Date(Math.max(...periodsArr.map((p) => p.end.getTime())));
      await tx.campaign.update({
        where: { id: campaignId },
        data: { periodStart: minStart, periodEnd: maxEnd, splitByPeriods: true },
      });
    }

    // 5. Upsert screens, write metrics per period.
    for (const sc of body.screens) {
      const data = buildScreenWriteData(sc, typeIdByCode);
      const screen = await tx.screen.upsert({
        where: { campaignId_city_address: { campaignId, city: sc.city, address: sc.address } },
        create: { ...data, campaignId, city: sc.city, address: sc.address },
        update: data,
      });

      for (const m of sc.metrics) {
        // periodIdByKey is fully populated from sc.metrics in step 3 — the lookup
        // can't miss; the non-null assertion just narrows Map.get's T | undefined.
        const periodId = periodIdByKey.get(periodKey(m.periodStart, m.periodEnd))!;
        await tx.screenMetrics.create({
          data: {
            screenId: screen.id,
            periodId,
            otsPlan: m.otsPlan ? Math.round(m.otsPlan) : null,
            ratingPlan: m.ratingPlan != null ? Number(m.ratingPlan.toFixed(4)) : null,
            otsFact: m.otsFact ? Math.round(m.otsFact) : null,
            ratingFact: m.ratingFact != null ? Number(m.ratingFact.toFixed(4)) : null,
            universe: m.universe ? Math.round(m.universe) : null,
            source: 'XLSX',
          },
        });
      }
    }

    // 6. Update campaign.sourceFileUrl + yandexMapUrl. NO ScreenPricing writes —
    //    the OTHER_CARRIERS flow gets pricing entirely from the campaign form.
    const campaignUpdate: Prisma.CampaignUpdateInput = {};
    if (body.minioKey !== undefined) campaignUpdate.sourceFileUrl = body.minioKey || undefined;
    if (body.yandexMapUrl !== undefined) campaignUpdate.yandexMapUrl = body.yandexMapUrl || undefined;
    if (Object.keys(campaignUpdate).length > 0) {
      await tx.campaign.update({ where: { id: campaignId }, data: campaignUpdate });
    }
  });
}
