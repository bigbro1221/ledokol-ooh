import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface Props {
  params: Promise<{ locale: string }>;
}

function ErrorCard({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Ledokol<span className="text-[var(--brand-primary)]">.</span>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 space-y-3 text-center">
          <p className="text-[14px] text-[var(--danger)]">{message}</p>
          {hint && <p className="text-[13px] text-[var(--text-3)]">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export default async function ActivateCompletePage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const userId = cookieStore.get('activation-session')?.value;

  if (!userId) {
    return (
      <ErrorCard
        message="Activation session expired or missing."
        hint="Please use your activation link again."
      />
    );
  }

  const session = await auth();
  const sessionEmail = session?.user?.email;

  if (!session || !sessionEmail) {
    redirect(`/api/auth/signin/google?callbackUrl=/${locale}/activate/complete`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true },
  });

  if (!user) {
    return <ErrorCard message="Account not found." />;
  }

  if (user.status !== 'INVITED') {
    // Already activated — clear stale cookie and go to dashboard
    cookieStore.delete('activation-session');
    redirect(`/${locale}/dashboard`);
  }

  if (user.email.toLowerCase() !== sessionEmail.toLowerCase()) {
    return (
      <ErrorCard
        message={`Wrong Google account. Please sign in with ${user.email}.`}
        hint={`You signed in as ${sessionEmail}. Sign out of Google and try again.`}
      />
    );
  }

  // Activate: set status = ACTIVE, clear cookie
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'ACTIVE' },
  });

  cookieStore.delete('activation-session');

  redirect(`/${locale}/dashboard`);
}
