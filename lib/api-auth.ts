import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true, session };
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  if (result.session.user.role !== 'ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return result;
}

export async function requireOwnership(clientId: string): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  // Admins can access everything
  if (result.session.user.role === 'ADMIN') return result;
  // Clients can only access their own data
  if (result.session.user.clientId !== clientId) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return result;
}

// Simple in-memory rate limiter
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_ATTEMPTS = 10;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}
