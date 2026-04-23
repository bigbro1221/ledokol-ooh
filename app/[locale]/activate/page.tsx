import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { peekActivationToken, consumeActivationToken } from '@/lib/activation';
import { prisma } from '@/lib/db';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Ledokol<span className="text-[var(--brand-primary)]">.</span>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[14px] text-[var(--danger)]">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default async function ActivatePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <ErrorCard message="Invalid activation link." />;
  }

  const check = await peekActivationToken(token);

  if (check.status === 'expired') {
    return <ErrorCard message="This activation link has expired. Contact your admin for a new one." />;
  }
  if (check.status === 'consumed') {
    return <ErrorCard message="This activation link has already been used. If you need a new one, contact your admin." />;
  }
  if (check.status !== 'valid') {
    return <ErrorCard message="This activation link is invalid." />;
  }

  const user = await prisma.user.findUnique({
    where: { id: check.userId },
    select: { email: true, status: true },
  });

  if (!user || user.status !== 'INVITED') {
    return <ErrorCard message="This account is already activated or does not exist." />;
  }

  // Server Action: consume token, set session cookie, redirect to Google OAuth
  async function handleActivate() {
    'use server';
    const result = await consumeActivationToken(token!);
    if (!result) {
      redirect(`/${locale}/activate?token=${encodeURIComponent(token!)}&error=expired`);
    }
    const cookieStore = await cookies();
    cookieStore.set('activation-session', result.userId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
      secure: process.env.NODE_ENV === 'production',
    });
    redirect(`/api/auth/signin/google?callbackUrl=/${locale}/activate/complete`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="fixed right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px]">
        <div className="mb-10 text-center">
          <div className="mb-4 text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Ledokol<span className="text-[var(--brand-primary)]">.</span>
          </div>
          <h1 className="text-[22px] font-medium tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            Welcome!
          </h1>
          <p className="mt-2 text-[13px] text-[var(--text-3)]">
            {user.email}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8">
          <p className="mb-6 text-[14px] leading-relaxed text-[var(--text-2)]">
            Link your Google account to activate your Ledokol OOH Dashboard account.
          </p>

          <form action={handleActivate}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.67 3.67 0 0 1-1.6 2.41v2h2.6c1.52-1.4 2.4-3.46 2.4-5.87Z" fill="#fff" fillOpacity=".9"/>
                <path d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.9 4.9 0 0 1-2.7.74c-2.08 0-3.84-1.4-4.47-3.29H.86v2.08A8 8 0 0 0 8 16Z" fill="#fff" fillOpacity=".75"/>
                <path d="M3.53 9.5A4.8 4.8 0 0 1 3.28 8c0-.52.09-1.03.25-1.5V4.42H.86A8 8 0 0 0 0 8c0 1.29.31 2.51.86 3.58L3.53 9.5Z" fill="#fff" fillOpacity=".6"/>
                <path d="M8 3.18c1.17 0 2.22.4 3.05 1.2l2.28-2.28A8 8 0 0 0 .86 4.42L3.53 6.5C4.16 4.6 5.92 3.18 8 3.18Z" fill="#fff" fillOpacity=".8"/>
              </svg>
              Link Google account
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
          Ledokol Group OOH Dashboard
        </p>
      </div>
    </div>
  );
}
