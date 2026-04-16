'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function LogoutButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
    >
      <LogOut size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}
