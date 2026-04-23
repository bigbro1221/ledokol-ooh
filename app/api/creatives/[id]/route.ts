import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deleteFile } from '@/lib/minio';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const updated = await prisma.creative.update({ where: { id }, data: { name } });
  return NextResponse.json({ id: updated.id, name: updated.name });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const creative = await prisma.creative.findUnique({ where: { id } });
  if (!creative) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Swallow MinIO errors: the objects may already be gone. We still want to
  // remove the DB row so the UI doesn't show an orphan.
  await deleteFile(creative.fileKey).catch(() => {});
  if (creative.thumbnailKey) await deleteFile(creative.thumbnailKey).catch(() => {});
  await prisma.creative.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
