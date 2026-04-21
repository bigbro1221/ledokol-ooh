import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { User, Mail, Shield, Building2, Globe, Calendar } from 'lucide-react';
import Link from 'next/link';
import { getUserPreferences } from '@/lib/user-preferences';
import { DateFormatPicker } from '@/components/ui/date-format-picker';
import type { DateFormat } from '@/lib/format-period';

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Администратор', CLIENT: 'Клиент' };
const LANG_LABELS: Record<string, string> = { RU: 'Русский', EN: 'English', UZ: "O'zbek", TR: 'Türkçe' };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const [user, prefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, email: true, role: true, language: true, createdAt: true,
        client: { select: { name: true, contactPerson: true } },
      },
    }),
    getUserPreferences(session.user.id),
  ]);

  if (!user) redirect(`/${locale}/login`);

  const initialDateFormat = prefs.dateFormat.toLowerCase() as DateFormat;

  const isAdmin = user.role === 'ADMIN';

  const fields = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Shield, label: 'Роль', value: ROLE_LABELS[user.role] || user.role },
    ...(user.client ? [{ icon: Building2, label: 'Компания', value: user.client.name }] : []),
    ...(user.client?.contactPerson ? [{ icon: User, label: 'Контактное лицо', value: user.client.contactPerson }] : []),
    { icon: Globe, label: 'Язык интерфейса', value: LANG_LABELS[user.language] || user.language },
    { icon: Calendar, label: 'Аккаунт создан', value: user.createdAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) },
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
            &larr; {isAdmin ? 'Администрирование' : 'Дашборд'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-4 py-12 sm:px-8">
        {/* Profile header */}
        <div className="mb-10 flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary-subtle)]">
            <User size={28} strokeWidth={1.5} className="text-[var(--brand-primary)]" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{user.email}</h1>
            <p className="mt-0.5 text-sm text-[var(--text-3)]">
              {ROLE_LABELS[user.role]}
              {user.client && <> &middot; {user.client.name}</>}
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-[15px] font-semibold">Профиль</h2>
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
            <h2 className="text-[15px] font-semibold">Формат дат</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-3)]">Как отображать период кампании в заголовке</p>
          </div>
          <div className="p-6">
            <DateFormatPicker initialFormat={initialDateFormat} locale={locale} />
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-8 flex gap-3">
          {isAdmin && (
            <Link
              href={`/${locale}/admin`}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
            >
              Администрирование
            </Link>
          )}
          <Link
            href={`/${locale}/dashboard`}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
          >
            Дашборд
          </Link>
        </div>
      </main>
    </div>
  );
}
