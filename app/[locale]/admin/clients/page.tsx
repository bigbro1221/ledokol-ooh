import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Plus, ChevronRight } from 'lucide-react';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ClientsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const clients = await prisma.client.findMany({
    include: { _count: { select: { campaigns: true, users: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Клиенты</h1>
        <Link
          href={`/${locale}/admin/clients/new`}
          aria-label="Новый клиент"
          className="flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] sm:min-h-0 sm:px-4"
        >
          <Plus size={16} strokeWidth={1.5} />
          {/* mobile: <640px — hide label */}
          <span className="hidden sm:inline">Новый клиент</span>
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Название</th>
              {/* mobile: <640px — hide contact person */}
              <th className="hidden border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)] sm:table-cell">Контактное лицо</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Кампании</th>
              {/* mobile: <640px — hide users count */}
              <th className="hidden border-b border-[var(--border)] px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)] sm:table-cell">Пользователи</th>
              {/* mobile chevron column */}
              <th className="w-8 border-b border-[var(--border)] sm:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="transition-colors hover:bg-[var(--surface-2)]">
                <td className="border-b border-[var(--border)] px-4 py-3">
                  <Link href={`/${locale}/admin/clients/${c.id}`} className="block text-sm font-medium hover:text-[var(--brand-primary)]">
                    {c.name}
                  </Link>
                </td>
                <td className="hidden border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)] sm:table-cell">{c.contactPerson || '—'}</td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-right text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{c._count.campaigns}</td>
                <td className="hidden border-b border-[var(--border)] px-4 py-3 text-right text-sm sm:table-cell" style={{ fontFamily: 'var(--font-mono)' }}>{c._count.users}</td>
                <td className="border-b border-[var(--border)] pr-3 sm:hidden">
                  <Link href={`/${locale}/admin/clients/${c.id}`} aria-label={`Open ${c.name}`} className="flex h-11 w-11 items-center justify-center text-[var(--text-4)]">
                    <ChevronRight size={16} strokeWidth={1.5} />
                  </Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--text-3)]">
                  Нет клиентов. Создайте первого.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
