'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LayoutDashboard, Users, Building2, Megaphone, Menu, X, ShieldCheck, LogOut, type LucideIcon } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { UserNav } from '@/components/ui/user-nav';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function AdminShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar locale={locale} onClose={() => setMobileOpen(false)} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex h-12 items-center border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="text-[var(--text-2)]">
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <Image src="/ledokol-logo.svg" alt="Ledokol" width={100} height={28} className="ml-3 h-6 w-auto" />
        </div>
        <main className="bg-[var(--bg)] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

function AdminSidebar({ locale, onClose }: { locale: string; onClose: () => void }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const pathname = usePathname();

  const links: NavItem[] = [
    { href: `/${locale}/admin`, label: t('dashboard'), icon: LayoutDashboard, exact: true },
    { href: `/${locale}/admin/clients`, label: t('clients'), icon: Building2 },
    { href: `/${locale}/admin/campaigns`, label: t('campaigns'), icon: Megaphone },
    { href: `/${locale}/admin/users`, label: t('users'), icon: Users },
    { href: `/${locale}/admin/auth-events`, label: t('authEvents'), icon: ShieldCheck },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 pb-6">
        <Image src="/ledokol-logo.svg" alt="Ledokol" width={110} height={30} className="h-7 w-auto" />
        <button onClick={onClose} className="lg:hidden">
          <X size={18} />
        </button>
      </div>

      <p className="mb-2 px-4 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">
        {t('sectionLabel')}
      </p>
      <nav className="flex-1 space-y-0.5 px-2">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--brand-primary-subtle)] font-medium text-[var(--brand-primary)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        <UserNav locale={locale} />
        <div className="mt-1 flex items-center justify-between gap-2">
          <LocaleSwitcher />
          <div className="flex items-center gap-1">
            <ThemeToggle />
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
        </div>
      </div>
    </div>
  );
}
