import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { requireAdmin } from '@/lib/api-auth';
import type { UserStatus } from '@prisma/client';

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'CLIENT']).optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'DISABLED']).optional(),
  enabled: z.boolean().optional(),
  clientId: z.string().uuid().nullable().optional(),
  language: z.enum(['RU', 'EN', 'UZ']).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, role: true, status: true, enabled: true,
      language: true, clientId: true,
      client: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.status !== undefined) data.status = parsed.data.status as UserStatus;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.clientId !== undefined) data.clientId = parsed.data.clientId;
  if (parsed.data.language !== undefined) data.language = parsed.data.language;
  if (parsed.data.password) data.passwordHash = await hash(parsed.data.password, 12);

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ id: user.id, email: user.email, role: user.role, status: user.status, enabled: user.enabled });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin();
  if (!result.ok) return result.response;

  const { id } = await params;
  if (result.session.user.id === id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
