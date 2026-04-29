import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminShell } from '@/components/layout/admin-sidebar';
import { ClientTopbar } from '@/components/layout/client-topbar';

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  if (session.user.role === 'ADMIN') {
    return <AdminShell locale={locale}>{children}</AdminShell>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <ClientTopbar locale={locale} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
