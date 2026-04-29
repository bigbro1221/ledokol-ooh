'use client';

import { signIn, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleToggle } from '@/components/ui/locale-toggle';

function validateCallbackUrl(callbackUrl: string | null): string {
  const DEFAULT_REDIRECT = '/';
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

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf-token');
  if (!res.ok) throw new Error('csrf_fetch_failed');
  const data = await res.json();
  return data.token as string;
}

interface Props {
  googleConfigured: boolean;
}

function mapOAuthError(code: string | null, t: (key: string) => string): string {
  if (!code) return '';
  switch (code) {
    case 'OAuthAccountNotLinked':
      return t('errorOAuthConflict');
    case 'GoogleInUse':
      return t('errorGoogleInUse');
    case 'GoogleNotInvited':
    case 'Callback':
    case 'OAuthCreateAccount':
      return t('errorGoogleNotInvited');
    case 'AccountDisabled':
      return t('errorAccountDisabled');
    case 'AccessDenied':
      return t('errorAccessDenied');
    default:
      return t('errorGeneric');
  }
}

export function LoginForm({ googleConfigured }: Props) {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlError = mapOAuthError(searchParams.get('error'), t);
  const [view, setView] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(urlError);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Clear stale session on OAuth error so the next attempt starts clean
  useEffect(() => {
    if (searchParams.get('error')) {
      signOut({ redirect: false });
    }
  }, [searchParams]);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown(seconds = 60) {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  async function sendCode(targetEmail: string) {
    setError('');
    setLoading(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ email: targetEmail }),
      });

      if (res.status === 429) {
        const data = await res.json();
        const wait = data.retryAfter ?? 60;
        setError(t('rateLimited', { seconds: wait }));
        startCooldown(wait);
        return;
      }

      if (res.status === 404) {
        setError(t('errorEmailNotRegistered'));
        return;
      }

      if (!res.ok) {
        setError(t('genericError'));
        return;
      }

      setView('code');
      setCode('');
      startCooldown(60);
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    await sendCode(email);
  }

  async function verifyCode() {
    setError('');
    setIsSubmitting(true);
    const result = await signIn('credentials', { email, code, redirect: false });
    if (result?.error) {
      setError(t('wrongCode'));
      setCode('');
      setIsSubmitting(false);
      return;
    }
    const callbackUrl = validateCallbackUrl(searchParams.get('callbackUrl'));
    router.push(callbackUrl);
    router.refresh();
    // isSubmitting stays true during navigation; component unmounts naturally
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;
    await verifyCode();
  }

  useEffect(() => {
    if (view !== 'code' || !/^\d{6}$/.test(code) || isSubmitting) return;
    verifyCode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, view, isSubmitting]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    // Kill any lingering session before starting OAuth — otherwise NextAuth
    // may refuse the new Google account if the cached session user doesn't
    // match the OAuth user (throws OAuthAccountNotLinked).
    await signOut({ redirect: false });
    const callbackUrl = validateCallbackUrl(searchParams.get('callbackUrl'));
    await signIn('google', { callbackUrl });
  }

  const inputClass =
    'w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--border-em)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-primary-subtle)]';
  const inputStyle = { transition: 'border-color var(--duration-fast) var(--ease-out-soft), box-shadow var(--duration-fast) var(--ease-out-soft)' };
  const primaryBtnClass =
    'w-full rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-5 py-2.5 text-[13px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed';
  const primaryBtnStyle = { transition: 'background-color var(--duration-fast) var(--ease-out-soft)' };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="fixed right-6 top-6 flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[380px]">
        {/* Logo + heading */}
        <div className="mb-10 text-center">
          <Image
            src="/ledokol-logo.svg"
            alt="Ledokol"
            width={140}
            height={36}
            priority
            className="mx-auto mb-6 h-12 w-auto"
          />
          <h1
            className="text-[22px] font-medium tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('loginTitle')}
          </h1>
          <p className="mt-2 text-[13px] text-[var(--text-3)]">
            {view === 'email' ? t('loginDescription') : t('codeSentTo', { email })}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8">
          {view === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-5">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div className="rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[13px] text-[var(--danger)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || cooldown > 0}
                className={primaryBtnClass}
                style={primaryBtnStyle}
                onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand-primary)')}
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('sendCode')}
                  </span>
                ) : cooldown > 0 ? (
                  t('resendIn', { seconds: cooldown })
                ) : (
                  t('sendCode')
                )}
              </button>

              {googleConfigured && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    <span className="text-[11px] text-[var(--text-4)]">{t('or')}</span>
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
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label
                  htmlFor="code"
                  className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]"
                >
                  {t('enterCode')}
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => { setError(''); setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                  className={`${inputClass} text-center text-[22px] font-semibold tracking-[0.2em]`}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div className="rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[13px] text-[var(--danger)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || code.length < 6}
                className={primaryBtnClass}
                style={primaryBtnStyle}
                onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand-primary)')}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('login')}
                  </span>
                ) : (
                  t('login')
                )}
              </button>

              <div className="text-center">
                {cooldown > 0 ? (
                  <span className="text-[12px] text-[var(--text-4)]">
                    {t('resendIn', { seconds: cooldown })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendCode(email)}
                    className="text-[12px] text-[var(--brand-primary)] hover:underline"
                  >
                    {t('resendNow')}
                  </button>
                )}
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setView('email'); setError(''); setCode(''); }}
                  className="text-[12px] text-[var(--text-3)] hover:text-[var(--text-2)] hover:underline"
                >
                  {t('useDifferentEmail')}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
          Ledokol Group OOH Dashboard
        </p>
      </div>
    </div>
  );
}
