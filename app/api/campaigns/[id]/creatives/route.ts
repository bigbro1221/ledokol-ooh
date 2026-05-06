import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { uploadFile } from '@/lib/minio';

const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_MIME = [...VIDEO_MIME, ...IMAGE_MIME];
const MAX_SIZE = 500 * 1024 * 1024; // 500MB per file

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: campaignId } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const thumbnail = formData.get('thumbnail') as File | null;
  const name = (formData.get('name') as string | null)?.trim() || null;
  const width = Number(formData.get('width')) || null;
  const height = Number(formData.get('height')) || null;
  const durationSec = Number(formData.get('durationSec')) || null;
  const kindRaw = (formData.get('kind') as string | null) ?? 'CREATIVE';
  const kind = kindRaw === 'REPORT' ? 'REPORT' : 'CREATIVE';

  if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 500MB)' }, { status: 413 });
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'bin';
  const fileKey = `creatives/${campaignId}/${randomUUID()}.${ext}`;
  const fileBuf = Buffer.from(await file.arrayBuffer());
  await uploadFile(fileKey, fileBuf, file.type || 'application/octet-stream');

  let thumbnailKey: string | null = null;
  if (thumbnail && thumbnail.size > 0) {
    const thumbExt = thumbnail.type === 'image/jpeg' ? 'jpg' : 'png';
    thumbnailKey = `creatives/${campaignId}/${randomUUID()}.${thumbExt}`;
    const thumbBuf = Buffer.from(await thumbnail.arrayBuffer());
    await uploadFile(thumbnailKey, thumbBuf, thumbnail.type || 'image/jpeg');
  }

  const created = await prisma.creative.create({
    data: {
      campaignId,
      kind,
      name: name || file.name,
      fileKey,
      thumbnailKey,
      mimeType: file.type || 'application/octet-stream',
      width: width && width > 0 ? width : null,
      height: height && height > 0 ? height : null,
      sizeBytes: BigInt(file.size),
      durationSec: durationSec && durationSec > 0 ? Math.round(durationSec) : null,
    },
  });

  return NextResponse.json({
    id: created.id,
    name: created.name,
    mimeType: created.mimeType,
    kind: created.kind,
    width: created.width,
    height: created.height,
    sizeBytes: Number(created.sizeBytes),
    durationSec: created.durationSec,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id: campaignId } = await params;
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const where: { campaignId: string; kind?: 'CREATIVE' | 'REPORT' } = { campaignId };
  if (kind === 'CREATIVE' || kind === 'REPORT') where.kind = kind;
  const rows = await prisma.creative.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    mimeType: r.mimeType,
    kind: r.kind,
    width: r.width,
    height: r.height,
    sizeBytes: Number(r.sizeBytes),
    durationSec: r.durationSec,
  })));
}
