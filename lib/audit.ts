import { prisma } from '@/lib/db';
import type { AuthEventLevel } from '@prisma/client';

export interface AuthEventInput {
  type: string;
  level?: AuthEventLevel;
  userId?: string | null;
  userEmail?: string | null;
  provider?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Persist an auth-flow event to the AuthEvent table. Fire-and-forget — never
 * throws and never blocks the auth pipeline; on DB failure we just log to
 * stderr so it still shows up in container logs.
 */
export function recordAuthEvent(input: AuthEventInput): void {
  prisma.authEvent
    .create({
      data: {
        type: input.type,
        level: input.level ?? 'INFO',
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        provider: input.provider ?? null,
        message: input.message,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    })
    .catch((err) => {
      console.error('[audit] failed to persist auth event', {
        type: input.type,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
