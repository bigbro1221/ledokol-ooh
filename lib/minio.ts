import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await ensureBucket();
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return key;
}

export async function getFileUrl(key: string): Promise<string> {
  // Route through our own /api/storage proxy so the URL works from browsers —
  // presigned S3 URLs embed the internal Docker hostname (minio:9000), which
  // isn't reachable from outside the app container.
  return `/api/storage/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Returns a time-limited presigned S3 URL. Only safe for server-to-server use
 * (e.g. admin exports that hit MinIO directly) — don't send this to browsers.
 */
export async function getSignedFileUrl(key: string, expiresInSec = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSec });
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
