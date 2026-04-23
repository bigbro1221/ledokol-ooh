import { randomBytes } from 'crypto';
import { hash, compare } from 'bcryptjs';
import { prisma } from '@/lib/db';

export function parseActivationToken(token: string): { userId: string; rawToken: string } | null {
  const dotIndex = token.indexOf('.');
  if (dotIndex < 1) return null;
  return { userId: token.slice(0, dotIndex), rawToken: token.slice(dotIndex + 1) };
}

export function buildActivationUrl(userId: string, rawToken: string, locale: string, baseUrl: string): string {
  return `${baseUrl}/${locale}/activate?token=${encodeURIComponent(`${userId}.${rawToken}`)}`;
}

export async function issueActivationToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = await hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.activationToken.upsert({
    where: { userId },
    create: { userId, tokenHash, expiresAt },
    update: { tokenHash, expiresAt, consumedAt: null },
  });

  return rawToken;
}

type TokenStatus = 'valid' | 'invalid' | 'expired' | 'consumed';

export async function peekActivationToken(token: string): Promise<{ status: TokenStatus; userId: string }> {
  const parsed = parseActivationToken(token);
  if (!parsed) return { status: 'invalid', userId: '' };

  const { userId, rawToken } = parsed;
  const record = await prisma.activationToken.findUnique({ where: { userId } });

  if (!record) return { status: 'invalid', userId };
  if (record.consumedAt) return { status: 'consumed', userId };
  if (record.expiresAt < new Date()) return { status: 'expired', userId };

  const isValid = await compare(rawToken, record.tokenHash);
  return { status: isValid ? 'valid' : 'invalid', userId };
}

export async function consumeActivationToken(token: string): Promise<{ userId: string } | null> {
  const parsed = parseActivationToken(token);
  if (!parsed) return null;

  const { userId, rawToken } = parsed;
  const record = await prisma.activationToken.findUnique({ where: { userId } });

  if (!record || record.consumedAt || record.expiresAt < new Date()) return null;

  const isValid = await compare(rawToken, record.tokenHash);
  if (!isValid) return null;

  await prisma.activationToken.update({
    where: { userId },
    data: { consumedAt: new Date() },
  });

  return { userId };
}
