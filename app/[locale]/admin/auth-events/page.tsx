import { prisma } from '@/lib/db';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthEventsClient } from './auth-events-client';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; level?: string; email?: string }>;
}

const PAGE_SIZE = 100;

export default async function AuthEventsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { type, level, email } = await searchParams;

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session.user.role !== 'ADMIN') redirect(`/${locale}/dashboard`);
  if (session.user.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }

  const t = await getTranslations({ locale, namespace: 'admin' });

  const where: {
    type?: string;
    level?: 'INFO' | 'WARN' | 'ERROR';
    userEmail?: { contains: string; mode: 'insensitive' };
  } = {};
  if (type) where.type = type;
  if (level === 'INFO' || level === 'WARN' || level === 'ERROR') where.level = level;
  if (email) where.userEmail = { contains: email, mode: 'insensitive' };

  const [events, distinctTypes] = await Promise.all([
    prisma.authEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
    }),
    prisma.authEvent.findMany({
      distinct: ['type'],
      select: { type: true },
      orderBy: { type: 'asc' },
    }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{t('authEvents')}</h1>
        <p className="text-xs text-[var(--text-3)]">
          {events.length === PAGE_SIZE ? `Showing latest ${PAGE_SIZE}` : `${events.length} events`}
        </p>
      </div>

      <AuthEventsClient
        locale={locale}
        types={distinctTypes.map(t => t.type)}
        currentType={type ?? ''}
        currentLevel={level ?? ''}
        currentEmail={email ?? ''}
        events={events.map(e => ({
          id: e.id,
          createdAt: e.createdAt.toISOString(),
          type: e.type,
          level: e.level,
          provider: e.provider,
          userEmail: e.userEmail,
          message: e.message,
          metadata: e.metadata as Record<string, unknown> | null,
        }))}
      />
    </div>
  );
}
