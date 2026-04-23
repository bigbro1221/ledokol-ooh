import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { issueActivationToken, buildActivationUrl } from '@/lib/activation';
import { renderActivationEmail } from '@/lib/email-templates/activation';
import { sendEmail } from '@/lib/mail';
import { SuppressedEmailError } from '@/lib/suppression';

function langToLocale(lang: string): 'ru' | 'en' | 'uz' {
  if (lang === 'EN') return 'en';
  if (lang === 'UZ') return 'uz';
  return 'ru';
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, status: true, language: true, name: true },
  });

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.status !== 'INVITED') {
    return NextResponse.json({ error: 'User is not in INVITED status' }, { status: 400 });
  }

  const rawToken = await issueActivationToken(user.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const locale = langToLocale(user.language);
  const activationUrl = buildActivationUrl(user.id, rawToken, locale, baseUrl);

  try {
    const { subject, html, text } = renderActivationEmail({
      activationUrl,
      userName: user.name ?? undefined,
      locale,
    });
    await sendEmail({ to: user.email, subject, html, text });
  } catch (err) {
    if (err instanceof SuppressedEmailError) {
      return NextResponse.json({ error: 'Email address is suppressed — remove suppression first' }, { status: 422 });
    }
    console.error('[resend-activation] email failed', { email: user.email, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
