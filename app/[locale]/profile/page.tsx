import { auth, isGoogleOAuthConfigured } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { User, Mail, Shield, Building2, Globe, Calendar } from 'lucide-react';
import Link from 'next/link';
import { getUserPreferences } from '@/lib/user-preferences';
import { DateFormatPicker } from '@/components/ui/date-format-picker';
import { GoogleLinkButton } from '@/components/auth/google-link-button';
import type { DateFormat } from '@/lib/format-period';
import { getTranslations } from 'next-intl/server';

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ mustLinkGoogle?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const ta = await getTranslations({ locale, namespace: 'auth' });
  const tp = await getTranslations({ locale, namespace: 'profile' });
  const tRoles = await getTranslations({ locale, namespace: 'roles' });
  const tLang = await getTranslations({ locale, namespace: 'languages' });
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const googleConfigured = isGoogleOAuthConfigured();

  const [user, prefs, googleAccount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, email: true, role: true, language: true, createdAt: true,
        client: { select: { name: true, contactPerson: true } },
      },
    }),
    getUserPreferences(session.user.id),
    googleConfigured
      ? prisma.account.findFirst({
          where: { userId: session.user.id, provider: 'google' },
          select: { providerAccountId: true },
        })
      : Promise.resolve(null),
  ]);

  if (!user) redirect(`/${locale}/login`);

  const initialDateFormat = prefs.dateFormat.toLowerCase() as DateFormat;
  const isAdmin = user.role === 'ADMIN';
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';

  const fields = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Shield, label: tp('fieldRole'), value: tRoles(user.role) },
    ...(user.client ? [{ icon: Building2, label: tp('fieldCompany'), value: user.client.name }] : []),
    ...(user.client?.contactPerson ? [{ icon: User, label: tp('fieldContact'), value: user.client.contactPerson }] : []),
    { icon: Globe, label: tp('fieldLanguage'), value: tLang(user.language) },
    { icon: Calendar, label: tp('fieldCreated'), value: user.createdAt.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Simple nav */}
      <header className="sticky top-0 z-10 h-16 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex h-full max-w-[800px] items-center gap-4 px-4 sm:px-8">
          <Link
            href={isAdmin ? `/${locale}/admin` : `/${locale}/dashboard`}
            className="text-sm text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
          >
            &larr; {isAdmin ? tp('adminLink') : tp('dashboardLink')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-4 py-12 sm:px-8">
        {resolvedSearchParams?.mustLinkGoogle === "1" && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-100">
            <span>{ta('mustLinkGoogleBanner')}</span>
            <a
              href="#linked-accounts"
              className="shrink-0 rounded-md border border-red-400/40 px-3 py-1.5 text-[12px] font-medium text-red-100 transition-colors hover:bg-red-500/20"
            >
              {ta('linkGoogleCta')}
            </a>
          </div>
        )}
        {/* Profile header */}
        <div className="mb-10 flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary-subtle)]">
            <User size={28} strokeWidth={1.5} className="text-[var(--brand-primary)]" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{user.email}</h1>
            <p className="mt-0.5 text-sm text-[var(--text-3)]">
              {tRoles(user.role)}
              {user.client && <> &middot; {user.client.name}</>}
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-[15px] font-semibold">{tp('cardTitle')}</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {fields.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 px-6 py-4">
                <Icon size={16} strokeWidth={1.5} className="text-[var(--text-3)]" />
                <span className="w-40 shrink-0 text-[13px] text-[var(--text-3)]">{label}</span>
                <span className="text-[14px] text-[var(--text)]">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Display preferences card */}
        <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-[15px] font-semibold">{tp('dateFormatTitle')}</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-3)]">{tp('dateFormatSubtitle')}</p>
          </div>
          <div className="p-6">
            <DateFormatPicker initialFormat={initialDateFormat} locale={locale} />
          </div>
        </div>

        {/* Linked accounts — only shown when Google OAuth is configured */}
        {googleConfigured && (
          <div id="linked-accounts" className="mt-6 scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-[15px] font-semibold">{tp('linkedAccountsTitle')}</h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-3)]">{tp('linkedAccountsSubtitle')}</p>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.67 3.67 0 0 1-1.6 2.41v2h2.6c1.52-1.4 2.4-3.46 2.4-5.87Z" fill="#4285F4"/>
                <path d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.9 4.9 0 0 1-2.7.74c-2.08 0-3.84-1.4-4.47-3.29H.86v2.08A8 8 0 0 0 8 16Z" fill="#34A853"/>
                <path d="M3.53 9.5A4.8 4.8 0 0 1 3.28 8c0-.52.09-1.03.25-1.5V4.42H.86A8 8 0 0 0 0 8c0 1.29.31 2.51.86 3.58L3.53 9.5Z" fill="#FBBC05"/>
                <path d="M8 3.18c1.17 0 2.22.4 3.05 1.2l2.28-2.28A8 8 0 0 0 .86 4.42L3.53 6.5C4.16 4.6 5.92 3.18 8 3.18Z" fill="#EA4335"/>
              </svg>
              <div className="flex-1">
                <p className="text-[14px] font-medium">Google</p>
                {googleAccount ? (
                  <p className="text-[12px] text-[var(--success)]">{tp('linked')}</p>
                ) : (
                  <p className="text-[12px] text-[var(--text-3)]">{tp('notLinked')}</p>
                )}
              </div>
              {!googleAccount && (
                <GoogleLinkButton locale={locale} label={tp('linkBtn')} />
              )}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="mt-8 flex gap-3">
          {isAdmin && (
            <Link
              href={`/${locale}/admin`}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
            >
              {tp('adminLink')}
            </Link>
          )}
          <Link
            href={`/${locale}/dashboard`}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
          >
            {tp('dashboardLink')}
          </Link>
        </div>
      </main>
    </div>
  );
}
