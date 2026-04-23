import { prisma } from '@/lib/db';

interface RateLimitOptions {
  key: string;
  windowMs: number;
  max: number;
}

export async function checkAndConsumeRateLimit({
  key,
  windowMs,
  max,
}: RateLimitOptions): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
  const now = Date.now();
  const windowEnd = new Date(Math.ceil(now / windowMs) * windowMs);

  const entry = await prisma.rateLimitEntry.upsert({
    where: { key_windowEnd: { key, windowEnd } },
    create: { key, windowEnd, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (entry.count > max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowEnd.getTime() - now,
    };
  }

  return { allowed: true, remaining: max - entry.count };
}

export async function pruneExpired(): Promise<void> {
  await prisma.rateLimitEntry.deleteMany({ where: { windowEnd: { lt: new Date() } } });
}
