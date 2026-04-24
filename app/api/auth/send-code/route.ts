import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/mail';
import { SuppressedEmailError, isSuppressed } from '@/lib/suppression';
import { checkAndConsumeRateLimit, pruneExpired } from '@/lib/rate-limit';
import { renderLoginCodeEmail } from '@/lib/email-templates/login-code';

const EMAIL_SYNTAX_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WINDOW_MS = process.env.NODE_ENV === 'production'
  ? 60 * 60 * 1000  // 1 hour in prod
  : 60 * 1000;      // 1 minute in dev
const GENERIC_OK = { ok: true, retryInSeconds: 60 };

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const csrfCookie = req.cookies.get('ledokol.csrf')?.value;
  const csrfHeader = req.headers.get('x-csrf-token');
  if (!csrfCookie || csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_SYNTAX_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const ip = getClientIp(req);

  // Opportunistic prune of expired rate-limit windows
  pruneExpired().catch(() => {});

  const [emailLimit, ipLimit] = await Promise.all([
    checkAndConsumeRateLimit({ key: `send-code:email:${email}`, windowMs: WINDOW_MS, max: 5 }),
    checkAndConsumeRateLimit({ key: `send-code:ip:${ip}`, windowMs: WINDOW_MS, max: 20 }),
  ]);

  if (!emailLimit.allowed || !ipLimit.allowed) {
    const retryAfterMs = Math.max(emailLimit.retryAfterMs ?? 0, ipLimit.retryAfterMs ?? 0);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, enabled: true, language: true },
  });

  if (!user || !user.enabled) {
    return NextResponse.json({ error: 'EmailNotRegistered' }, { status: 404 });
  }

  const suppressed = await isSuppressed(email);
  if (suppressed) return NextResponse.json(GENERIC_OK);

  // Enforce 60-second resend cooldown
  const sixtySecondsAgo = new Date(Date.now() - 60_000);
  const recentCode = await prisma.emailLoginCode.findFirst({
    where: { userId: user.id, consumedAt: null, createdAt: { gte: sixtySecondsAgo } },
  });
  if (recentCode) return NextResponse.json(GENERIC_OK);

  const code = randomInt(100000, 1000000).toString();
  const codeHash = await hash(code, 10);

  // Invalidate all prior unconsumed codes for this user
  await prisma.emailLoginCode.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailLoginCode.create({
    data: {
      userId: user.id,
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    },
  });

  const rawLocale = user.language?.toLowerCase() ?? 'ru';
  const locale = (['ru', 'en', 'uz'] as const).includes(rawLocale as 'ru' | 'en' | 'uz')
    ? (rawLocale as 'ru' | 'en' | 'uz')
    : 'ru';

  try {
    const { subject, html, text } = renderLoginCodeEmail({ code, locale });
    await sendEmail({ to: email, subject, html, text });
  } catch (err) {
    if (!(err instanceof SuppressedEmailError)) {
      console.error('[send-code] email delivery failed', { email, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json(GENERIC_OK);
}
