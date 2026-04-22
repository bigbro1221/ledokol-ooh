import { LogoutButton } from '@/components/ui/logout-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleToggle } from '@/components/ui/locale-toggle';
import { UserNav } from '@/components/ui/user-nav';
import { useTranslations } from 'next-intl';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import Image from 'next/image';
import { Shield } from 'lucide-react';

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
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}

function DashboardNav({ locale, isAdmin }: { locale: string; isAdmin: boolean }) {
  const tc = useTranslations('common');
  const tn = useTranslations('nav');

  return (
    <header
      className="sticky top-0 z-10 h-14 border-b border-[var(--border)] bg-[var(--surface)] sm:h-16"
      style={{ transition: 'background-color 150ms var(--ease-out-soft), border-color 150ms var(--ease-out-soft)' }}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-2 px-3 sm:gap-4 sm:px-8">
        <Link href={`/${locale}/dashboard`} className="flex items-center">
          <Image src="/ledokol-logo.svg" alt="Ledokol" width={120} height={32} priority className="h-7 w-auto sm:h-8" />
        </Link>

        {isAdmin && (
          <Link
            href={`/${locale}/admin`}
            aria-label={tn('adminPanel')}
            className="flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-[12px] font-medium text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] sm:min-h-0"
          >
            <Shield size={16} strokeWidth={1.5} />
            {/* mobile: <640px — hide label */}
            <span className="hidden sm:inline">{tn('adminPanel')}</span>
          </Link>
        )}

        <div className="flex-1" />
        <UserNav locale={locale} />
        <LocaleToggle />
        <ThemeToggle />
        <LogoutButton label={tc('logout')} />
      </div>
    </header>
  );
}
