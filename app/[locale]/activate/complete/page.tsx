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

  if (!session?.user?.id) {
    redirect(`/api/auth/signin/google?callbackUrl=/${locale}/activate/complete`);
  }

  // The signIn callback guarantees session.user.id === cookie userId when the
  // activation cookie is set. Treat any mismatch as a tampered flow.
  if (session.user.id !== userId) {
    cookieStore.delete('activation-session');
    return <ErrorCard message="Activation flow mismatch." hint="Please request a new activation link." />;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user) {
    cookieStore.delete('activation-session');
    return <ErrorCard message="Account not found." />;
  }

  if (user.status !== 'INVITED') {
    cookieStore.delete('activation-session');
    redirect(`/${locale}/dashboard`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: 'ACTIVE' },
  });

  // Burn the activation token now that the flow has succeeded. updateMany
  // lets this be idempotent if the user lands here twice (e.g. browser back).
  await prisma.activationToken.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  cookieStore.delete('activation-session');

  redirect(`/${locale}/dashboard`);
}
