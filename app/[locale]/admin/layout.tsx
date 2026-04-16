'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogoutButton } from '@/components/ui/logout-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { UserNav } from '@/components/ui/user-nav';
import { LayoutDashboard, Users, Building2, Megaphone, Menu, X, BarChart3 } from 'lucide-react';
import { useState } from 'react';

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <AdminSidebar locale={params.locale} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex h-12 items-center border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="text-[var(--text-2)]">
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <span className="ml-3 text-sm font-semibold">Администрирование</span>
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

  const links = [
    { href: `/${locale}/admin`, label: t('dashboard'), icon: LayoutDashboard, exact: true },
    { href: `/${locale}/admin/clients`, label: t('clients'), icon: Building2 },
    { href: `/${locale}/admin/campaigns`, label: t('campaigns'), icon: Megaphone },
    { href: `/${locale}/admin/users`, label: 'Пользователи', icon: Users },
    { href: `/${locale}/dashboard`, label: 'Клиентский дашборд', icon: BarChart3, divider: true },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 pb-6">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <button onClick={onClose} className="lg:hidden"><X size={18} /></button>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {links.map(({ href, label, icon: Icon, exact, divider }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href) && !exact;
          return (
            <div key={href}>
              {divider && <div className="my-2 border-t border-[var(--border)]" />}
              <Link
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
            </div>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-2">
        <UserNav locale={locale} />
        <div className="mt-1 flex items-center gap-1">
          <LogoutButton label={tc('logout')} />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
