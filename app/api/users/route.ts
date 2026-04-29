import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { validateEmail } from '@/lib/email-validation';
import { issueActivationToken, buildActivationUrl } from '@/lib/activation';
import { renderActivationEmail } from '@/lib/email-templates/activation';
import { sendEmail } from '@/lib/mail';
import { SuppressedEmailError } from '@/lib/suppression';

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['ADMIN', 'CLIENT']),
  clientId: z.string().uuid().nullable().optional(),
  language: z.enum(['RU', 'EN', 'UZ']).optional(),
});

function langToLocale(lang: string): 'ru' | 'en' | 'uz' {
  if (lang === 'EN') return 'en';
  if (lang === 'UZ') return 'uz';
  return 'ru';
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      enabled: true,
      language: true,
      clientId: true,
      client: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const emailCheck = await validateEmail(parsed.data.email);
  if (!emailCheck.ok) {
    return NextResponse.json(
      { errors: { fieldErrors: { email: [emailCheck.reason ?? 'Invalid email address'] } } },
      { status: 422 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ errors: { fieldErrors: { email: ['Email already exists'] } } }, { status: 400 });
  }

  const language = parsed.data.language ?? 'RU';
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      role: parsed.data.role,
      status: 'INVITED',
      clientId: parsed.data.clientId || null,
      language,
    },
  });

  const rawToken = await issueActivationToken(user.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const locale = langToLocale(language);
  const activationUrl = buildActivationUrl(user.id, rawToken, locale, baseUrl);

  let inviteSent = false;
  try {
    const { subject, html, text } = renderActivationEmail({ activationUrl, locale });
    await sendEmail({ to: user.email, subject, html, text });
    inviteSent = true;
  } catch (err) {
    if (!(err instanceof SuppressedEmailError)) {
      console.error('[users/create] activation email failed', { email: user.email, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ id: user.id, email: user.email, role: user.role, status: user.status, inviteSent }, { status: 201 });
}
