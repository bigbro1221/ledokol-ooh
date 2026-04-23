'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

interface Props {
  label: string;
  /** Hide label on mobile, keep icon only. Default true. */
  labelResponsive?: boolean;
  callbackUrl?: string;
}

export function LogoutButton({ label, labelResponsive = true, callbackUrl = '/login' }: Props) {
  return (
    <button
      onClick={() => signOut({ callbackUrl })}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
    >
      <LogOut size={16} strokeWidth={1.5} />
      <span className={labelResponsive ? 'hidden sm:inline' : ''}>{label}</span>
    </button>
  );
}
