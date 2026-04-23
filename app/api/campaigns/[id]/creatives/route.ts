import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { uploadFile } from '@/lib/minio';

const ALLOWED_MIME = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/ogg',
];
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

  if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 500MB)' }, { status: 413 });
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'bin';
  const videoKey = `creatives/${campaignId}/${randomUUID()}.${ext}`;
  const videoBuf = Buffer.from(await file.arrayBuffer());
  await uploadFile(videoKey, videoBuf, file.type || 'application/octet-stream');

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
      name: name || file.name,
      fileKey: videoKey,
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
    width: created.width,
    height: created.height,
    sizeBytes: Number(created.sizeBytes),
    durationSec: created.durationSec,
  });
}
