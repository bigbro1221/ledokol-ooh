import { cookies } from 'next/headers';
import { peekActivationToken } from '@/lib/activation';
import { prisma } from '@/lib/db';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ActivateButton } from './activate-button';

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

  // Server Action invoked by the client button before kicking off Google OAuth.
  // Sets the activation-session cookie keyed to the invited user. The activation
  // token is NOT consumed here — that happens at /activate/complete, so users
  // can retry if anything fails on the OAuth round-trip.
  async function prepareActivation(): Promise<{ ok: true } | { ok: false; error: string }> {
    'use server';
    const recheck = await peekActivationToken(token!);
    if (recheck.status !== 'valid') {
      return { ok: false, error: 'Activation link is no longer valid.' };
    }
    const cookieStore = await cookies();
    cookieStore.set('activation-session', recheck.userId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
      secure: process.env.NODE_ENV === 'production',
    });
    return { ok: true };
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

          <ActivateButton
            prepareAction={prepareActivation}
            callbackUrl={`/${locale}/activate/complete`}
            label="Link Google account"
            errorLabel="Could not start activation. Please try again."
          />
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
          Ledokol Group OOH Dashboard
        </p>
      </div>
    </div>
  );
}
