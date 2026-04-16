'use client';

import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t('invalidCredentials'));
      return;
    }

    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Theme toggle — top right */}
      <div className="fixed right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[380px]">
        {/* Logo + heading */}
        <div className="mb-10 text-center">
          <div
            className="mb-4 text-[28px] font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ledokol<span className="text-[var(--brand-primary)]">.</span>
          </div>
          <h1
            className="text-[22px] font-medium tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('loginTitle')}
          </h1>
          <p className="mt-2 text-[13px] text-[var(--text-3)]">
            {t('loginDescription')}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]"
              >
                {t('email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@company.com"
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--border-em)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-primary-subtle)]"
                style={{ transition: 'border-color var(--duration-fast) var(--ease-out-soft), box-shadow var(--duration-fast) var(--ease-out-soft)' }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]"
              >
                {t('password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--border-em)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-primary-subtle)]"
                style={{ transition: 'border-color var(--duration-fast) var(--ease-out-soft), box-shadow var(--duration-fast) var(--ease-out-soft)' }}
              />
            </div>

            {error && (
              <div className="rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[13px] text-[var(--danger)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-5 py-2.5 text-[13px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                transition: 'background-color var(--duration-fast) var(--ease-out-soft)',
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand-primary)')}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Вход...
                </span>
              ) : (
                t('login')
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
          Ledokol Group OOH Dashboard
        </p>
      </div>
    </div>
  );
}
