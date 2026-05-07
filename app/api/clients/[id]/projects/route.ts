import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const projects = await prisma.campaignGroup.findMany({
    where: { clientId: id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(projects);
}
