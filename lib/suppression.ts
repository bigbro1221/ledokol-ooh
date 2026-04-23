import { prisma } from '@/lib/db';

const SOFT_BOUNCE_THRESHOLD = 5;

export class SuppressedEmailError extends Error {
  constructor(public readonly email: string) {
    super(`Email address is suppressed: ${email}`);
    this.name = 'SuppressedEmailError';
  }
}

/**
 * Returns true when the email is actively suppressed and should not receive mail.
 * Soft-bounce rows below the threshold are tracked but not yet suppressing.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.suppressedEmail.findUnique({
    where: { email },
    select: { removedAt: true, reason: true, softBounceCount: true },
  });
  if (!row) return false;
  if (row.removedAt !== null) return false;
  if (row.reason === 'SOFT_BOUNCE_REPEATED' && row.softBounceCount < SOFT_BOUNCE_THRESHOLD) return false;
  return true;
}

export async function suppress({
  email,
  reason,
  eventType,
  rawPayload,
}: {
  email: string;
  reason: 'HARD_BOUNCE' | 'SOFT_BOUNCE_REPEATED' | 'COMPLAINT' | 'MANUAL';
  eventType?: string;
  rawPayload?: string;
}): Promise<void> {
  await prisma.suppressedEmail.upsert({
    where: { email },
    create: { email, reason, eventType, lastRawPayload: rawPayload ?? null },
    update: {
      reason,
      eventType,
      lastRawPayload: rawPayload ?? null,
      suppressedAt: new Date(),
      removedAt: null,
    },
  });
}

export async function unsuppress(email: string): Promise<void> {
  await prisma.suppressedEmail.update({
    where: { email },
    data: { removedAt: new Date() },
  });
}

/**
 * Record a transient (soft) bounce. Suppresses automatically once the count
 * reaches SOFT_BOUNCE_THRESHOLD consecutive bounces.
 */
export async function recordSoftBounce(
  email: string,
  eventType?: string,
  rawPayload?: string,
): Promise<void> {
  const existing = await prisma.suppressedEmail.findUnique({
    where: { email },
    select: { softBounceCount: true, removedAt: true },
  });

  // Reset count if the row was previously un-suppressed
  const currentCount = existing && existing.removedAt === null ? existing.softBounceCount : 0;
  const newCount = currentCount + 1;

  await prisma.suppressedEmail.upsert({
    where: { email },
    create: {
      email,
      reason: 'SOFT_BOUNCE_REPEATED',
      eventType,
      softBounceCount: newCount,
      lastRawPayload: rawPayload ?? null,
    },
    update: {
      reason: 'SOFT_BOUNCE_REPEATED',
      eventType,
      softBounceCount: newCount,
      lastRawPayload: rawPayload ?? null,
      suppressedAt: new Date(),
      removedAt: null,
    },
  });
}
