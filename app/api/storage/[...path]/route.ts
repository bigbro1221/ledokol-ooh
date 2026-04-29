import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { requireAuth } from '@/lib/api-auth';

export const runtime = 'nodejs';

const BUCKET = process.env.MINIO_BUCKET || 'ooh-uploads';

const s3 = new S3Client({
  endpoint: `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { path } = await params;
  const key = path.map(decodeURIComponent).join('/');
  const range = req.headers.get('range') ?? undefined;

  try {
    // Forward Range header to S3 so video seek + progressive playback works.
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: range }));
    if (!obj.Body) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = Readable.toWeb(obj.Body as Readable) as unknown as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type': obj.ContentType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
    };
    if (obj.ContentLength != null) headers['Content-Length'] = String(obj.ContentLength);
    if (obj.ContentRange) headers['Content-Range'] = obj.ContentRange;
    if (obj.ETag) headers['ETag'] = obj.ETag;

    // S3 returns 206 implicitly for Range requests via ContentRange. We mirror
    // that to the client so the <video> element can seek.
    const status = range && obj.ContentRange ? 206 : 200;

    return new NextResponse(body, { status, headers });
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (name === 'InvalidRange') {
      return new NextResponse('Range Not Satisfiable', { status: 416 });
    }
    console.error('[storage] fetch failed', { key, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Storage error' }, { status: 500 });
  }
}
