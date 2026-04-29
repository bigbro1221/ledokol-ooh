import { peekActivationToken } from '@/lib/activation';
import { prisma } from '@/lib/db';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ActivateClient } from './activate-client';

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

  if (!user) {
    return <ErrorCard message="Account not found." />;
  }

  if (user.status !== 'INVITED') {
    return <ErrorCard message="This account is already activated." />;
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
          <ActivateClient
            token={token}
            callbackUrl={`/${locale}/profile?mustLinkGoogle=1`}
            loadingLabel="Activating your account…"
            errorLabel="Activation failed. Please request a new link from your admin."
          />
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
          Ledokol Group OOH Dashboard
        </p>
      </div>
    </div>
  );
}
