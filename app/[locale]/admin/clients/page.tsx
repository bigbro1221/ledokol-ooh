import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function ClientsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const clients = await prisma.client.findMany({
    include: { _count: { select: { campaigns: true, users: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Клиенты</h1>
        <Link
          href={`/${locale}/admin/clients/new`}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
        >
          <Plus size={16} strokeWidth={1.5} /> Новый клиент
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Название</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Контактное лицо</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Кампании</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Пользователи</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="transition-colors hover:bg-[var(--surface-2)]">
                <td className="border-b border-[var(--border)] px-4 py-3">
                  <Link href={`/${locale}/admin/clients/${c.id}`} className="text-sm font-medium hover:text-[var(--brand-primary)]">
                    {c.name}
                  </Link>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">{c.contactPerson || '—'}</td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-right text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{c._count.campaigns}</td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-right text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{c._count.users}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-[var(--text-3)]">
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
