import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';

const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  clientId: z.string().uuid('Invalid client'),
  periodStart: z.string().transform(s => new Date(s)),
  periodEnd: z.string().transform(s => new Date(s)),
  splitByPeriods: z.boolean().optional().default(false),
  heatmapUrl: z.string().url().optional().nullable(),
  yandexMapUrl: z.string().url().optional().nullable(),
  reportsUrl: z.string().url().optional().nullable(),
  acRate: z.number().min(0).max(1).optional().default(0),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const campaigns = await prisma.campaign.findMany({
    include: {
      client: { select: { name: true } },
      _count: { select: { screens: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(campaigns);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = CreateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({ data: parsed.data });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error('POST /api/campaigns failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
