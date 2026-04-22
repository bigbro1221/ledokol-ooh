'use client';

import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

function validateCallbackUrl(callbackUrl: string | null): string {
  const DEFAULT_REDIRECT = '/dashboard';
  if (!callbackUrl) return DEFAULT_REDIRECT;
  try {
    if (callbackUrl.startsWith('http://') || callbackUrl.startsWith('https://')) return DEFAULT_REDIRECT;
    if (callbackUrl.startsWith('//')) return DEFAULT_REDIRECT;
    if (!callbackUrl.startsWith('/')) return DEFAULT_REDIRECT;
    return callbackUrl;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

interface Props {
  googleConfigured: boolean;
}

export function LoginForm({ googleConfigured }: Props) {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError(t('invalidCredentials'));
      return;
    }

    const callbackUrl = validateCallbackUrl(searchParams.get('callbackUrl'));
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const callbackUrl = validateCallbackUrl(searchParams.get('callbackUrl'));
    await signIn('google', { callbackUrl });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
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
              style={{ transition: 'background-color var(--duration-fast) var(--ease-out-soft)' }}
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

          {/* Google sign-in — only rendered when OAuth is configured */}
          {googleConfigured && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-[11px] text-[var(--text-4)]">или</span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-3)] border-t-[var(--text)]" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.67 3.67 0 0 1-1.6 2.41v2h2.6c1.52-1.4 2.4-3.46 2.4-5.87Z" fill="#4285F4"/>
                    <path d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.9 4.9 0 0 1-2.7.74c-2.08 0-3.84-1.4-4.47-3.29H.86v2.08A8 8 0 0 0 8 16Z" fill="#34A853"/>
                    <path d="M3.53 9.5A4.8 4.8 0 0 1 3.28 8c0-.52.09-1.03.25-1.5V4.42H.86A8 8 0 0 0 0 8c0 1.29.31 2.51.86 3.58L3.53 9.5Z" fill="#FBBC05"/>
                    <path d="M8 3.18c1.17 0 2.22.4 3.05 1.2l2.28-2.28A8 8 0 0 0 .86 4.42L3.53 6.5C4.16 4.6 5.92 3.18 8 3.18Z" fill="#EA4335"/>
                  </svg>
                )}
                {t('signInWithGoogle')}
              </button>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
          Ledokol Group OOH Dashboard
        </p>
      </div>
    </div>
  );
}
