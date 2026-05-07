import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';

const CreateProjectSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { clientId, name } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 400 });
  }

  const dupe = await prisma.campaignGroup.findFirst({
    where: { clientId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: 'project_exists', existing: dupe },
      { status: 409 },
    );
  }

  const project = await prisma.campaignGroup.create({
    data: { clientId, name },
    select: { id: true, name: true },
  });
  return NextResponse.json(project, { status: 201 });
}
