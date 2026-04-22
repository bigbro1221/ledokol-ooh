'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface UserFormProps {
  locale: string;
  clients: { id: string; name: string }[];
  initial?: {
    id: string;
    email: string;
    role: string;
    enabled: boolean;
    clientId: string | null;
    language: string;
  };
}

export function UserForm({ locale, clients, initial }: UserFormProps) {
  const router = useRouter();
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const tf = useTranslations('forms');
  const tRoles = useTranslations('roles');
  const tLang = useTranslations('languages');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState(initial?.role || 'CLIENT');
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = !!initial;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      email: fd.get('email') as string,
      role: fd.get('role') as string,
      clientId: (fd.get('clientId') as string) || null,
      language: fd.get('language') as string,
    };

    const password = fd.get('password') as string;
    if (password) data.password = password;

    if (isEdit) {
      data.enabled = fd.get('enabled') === 'on';
    }

    const url = isEdit ? `/api/users/${initial.id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    if (!isEdit && !password) {
      setError(tf('passwordRequired'));
      setLoading(false);
      return;
    }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.errors?.fieldErrors?.email?.[0] || err.errors?.fieldErrors?.password?.[0] || tc('error'));
      return;
    }

    router.push(`/${locale}/admin/users`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{ta('email')}</label>
        <input
          name="email"
          type="email"
          required
          defaultValue={initial?.email}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {isEdit ? tf('passwordLabelEdit') : tf('passwordLabelNew')}
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            minLength={6}
            required={!isEdit}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 pr-9 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--text-4)] hover:text-[var(--text-2)]"
            tabIndex={-1}
            aria-label={showPassword ? ta('passwordHide') : ta('passwordShow')}
          >
            {showPassword ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{tf('role')}</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
        >
          <option value="ADMIN">{tRoles('ADMIN')}</option>
          <option value="CLIENT">{tRoles('CLIENT')}</option>
        </select>
      </div>

      {role === 'CLIENT' && (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{tf('company')}</label>
          <select
            name="clientId"
            defaultValue={initial?.clientId || ''}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
          >
            <option value="">{tf('notLinked')}</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{tf('language')}</label>
        <select
          name="language"
          defaultValue={initial?.language || 'RU'}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
        >
          <option value="RU">{tLang('RU')}</option>
          <option value="EN">{tLang('EN')}</option>
          <option value="UZ">{tLang('UZ')}</option>
          <option value="TR">{tLang('TR')}</option>
        </select>
      </div>

      {isEdit && (
        <div className="flex items-center gap-3">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={initial?.enabled}
            id="enabled"
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          <label htmlFor="enabled" className="text-sm">{tf('accountEnabled')}</label>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {loading ? '...' : isEdit ? tc('save') : tc('create')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
