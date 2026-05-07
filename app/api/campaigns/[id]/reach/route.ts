import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/api-auth';

const ReachEntrySchema = z.object({
  n: z.number().int().min(1).max(99),
  plan: z.number().finite().min(0).nullable().optional(),
  fact: z.number().finite().min(0).nullable().optional(),
});

const PutBodySchema = z.object({
  entries: z.array(ReachEntrySchema).max(30),
});

async function readSerialized(campaignId: string) {
  const rows = await prisma.reachEntry.findMany({
    where: { campaignId },
    select: { id: true, n: true, plan: true, fact: true },
    orderBy: { n: 'asc' },
  });
  return rows;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Admin can read any campaign's reach. Clients can only read campaigns
  // belonging to their own client_id.
  if (session.user.role === 'CLIENT') {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { client: { select: { users: { where: { id: session.user.id }, select: { id: true } } } } },
    });
    const owns = (campaign?.client?.users?.length ?? 0) > 0;
    if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await readSerialized(id);
  return NextResponse.json(rows);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminAuth = await requireAdmin();
  if (!adminAuth.ok) return adminAuth.response;

  const { id } = await params;
  const body = await request.json();
  const parsed = PutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  // Reject duplicate `n` within the payload (DB enforces too, but bail early for a clean 400).
  const seen = new Set<number>();
  for (const e of parsed.data.entries) {
    if (seen.has(e.n)) {
      return NextResponse.json({ error: 'duplicate_n', n: e.n }, { status: 400 });
    }
    seen.add(e.n);
  }

  // Verify campaign exists.
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Replace-all in a transaction.
  await prisma.$transaction([
    prisma.reachEntry.deleteMany({ where: { campaignId: id } }),
    ...(parsed.data.entries.length > 0
      ? [prisma.reachEntry.createMany({
          data: parsed.data.entries.map(e => ({
            campaignId: id,
            n: e.n,
            plan: e.plan ?? null,
            fact: e.fact ?? null,
          })),
        })]
      : []),
  ]);

  const rows = await readSerialized(id);
  return NextResponse.json(rows);
}
