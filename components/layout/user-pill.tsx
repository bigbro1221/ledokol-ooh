'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';

export function UserPill() {
  const { data: session } = useSession();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? 'ru';
  if (!session?.user) return null;

  const name = session.user.email || '';
  const initials = name.split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join('') || '?';

  return (
    <Link
      href={`/${locale}/profile`}
      aria-label={name}
      className="flex h-8 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--border-hi)] hover:bg-[var(--surface-2)] w-8 sm:w-auto sm:gap-2 sm:pl-1 sm:pr-3"
    >
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--brand-primary-subtle)] text-[10.5px] font-semibold text-[var(--brand-primary)]">
        {initials}
      </span>
      <span className="hidden text-[11.5px] font-medium leading-tight sm:inline">{name}</span>
    </Link>
  );
}
