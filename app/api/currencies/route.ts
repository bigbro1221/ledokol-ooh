import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const currencies = await prisma.currencyRef.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, nameRu: true, nameEn: true, nameUz: true },
  });
  return NextResponse.json(currencies);
}
