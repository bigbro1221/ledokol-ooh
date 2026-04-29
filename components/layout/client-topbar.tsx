'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { UserPill } from '@/components/layout/user-pill';

export function ClientTopbar({ locale }: { locale: string }) {
  const tc = useTranslations('common');
  const tcp = useTranslations('campaignsPage');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isProfile = pathname.endsWith('/profile');
  const isDashboardDetail = pathname.endsWith('/dashboard') && !!searchParams.get('campaign');

  return (
    <header className="sticky top-0 z-30 flex h-[66px] items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:gap-4 sm:px-6">
      <Link href={`/${locale}/dashboard`} className="flex items-center">
        <Image src="/ledokol-logo.svg" alt="Ledokol" width={120} height={32} className="h-[30px] w-auto" priority />
      </Link>

      <span className="h-[22px] w-px bg-[var(--border)]" />

      <nav className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-[var(--text-2)]">
        {isDashboardDetail || isProfile ? (
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-1 text-[var(--text-3)] hover:text-[var(--text)]">
            <ChevronLeft size={13} strokeWidth={1.5} />
            <span className="hidden sm:inline">{tcp('title')}</span>
          </Link>
        ) : (
          <span className="font-medium text-[var(--text)]">{tcp('title')}</span>
        )}
      </nav>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
        <span className="mx-0.5 hidden h-[22px] w-px bg-[var(--border)] sm:block" />
        <UserPill />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
          aria-label={tc('logout')}
          title={tc('logout')}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-3)] transition-colors hover:border-[var(--border-hi)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <LogOut size={14} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
