import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getUserPreferences, updateUserPreferences } from '@/lib/user-preferences';
import { DateFormat as DBDateFormat } from '@prisma/client';

const VALID_FORMATS = new Set<string>(Object.values(DBDateFormat));

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const prefs = await getUserPreferences(auth.session.user.id);
  return NextResponse.json(prefs);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { dateFormat } = body as { dateFormat?: unknown };
  if (dateFormat !== undefined && !VALID_FORMATS.has(dateFormat as string)) {
    return NextResponse.json({ error: 'Invalid dateFormat' }, { status: 400 });
  }

  const prefs = await updateUserPreferences(auth.session.user.id, {
    dateFormat: dateFormat as DBDateFormat | undefined,
  });
  return NextResponse.json(prefs);
}
