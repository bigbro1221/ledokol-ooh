'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { User } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Администратор', CLIENT: 'Клиент' };

export function UserNav({ locale }: { locale: string }) {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <Link
      href={`/${locale}/profile`}
      aria-label={session.user.email}
      className="flex min-h-[44px] items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors hover:bg-[var(--surface-2)] sm:min-h-0"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary-subtle)]">
        <User size={14} strokeWidth={1.5} className="text-[var(--brand-primary)]" />
      </div>
      {/* mobile: <640px — hide name/role, show only avatar */}
      <div className="hidden sm:block">
        <div className="text-[12px] font-medium leading-tight text-[var(--text)]">
          {session.user.email}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-[var(--text-3)]">
          {ROLE_LABELS[session.user.role] || session.user.role}
        </div>
      </div>
    </Link>
  );
}
