import { LogoutButton } from '@/components/ui/logout-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { UserNav } from '@/components/ui/user-nav';
import { useTranslations } from 'next-intl';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <DashboardNav locale={locale} isAdmin={isAdmin} />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}

function DashboardNav({ locale, isAdmin }: { locale: string; isAdmin: boolean }) {
  const tc = useTranslations('common');

  return (
    <header
      className="sticky top-0 z-10 h-16 border-b border-[var(--border)] bg-[var(--surface)]"
      style={{ transition: 'background-color 150ms var(--ease-out-soft), border-color 150ms var(--ease-out-soft)' }}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-4 px-4 sm:px-8">
        <div
          className="text-[22px] font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Ledokol<span className="text-[var(--brand-primary)]">.</span>
        </div>

        {isAdmin && (
          <Link
            href={`/${locale}/admin`}
            className="rounded-[var(--radius-md)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            Админ панель
          </Link>
        )}

        <div className="flex-1" />
        <UserNav locale={locale} />
        <ThemeToggle />
        <LogoutButton label={tc('logout')} />
      </div>
    </header>
  );
}
