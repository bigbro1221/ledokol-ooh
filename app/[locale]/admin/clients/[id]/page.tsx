import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { ClientForm } from '@/components/admin/client-form';
import Link from 'next/link';

export default async function EditClientPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { campaigns: { orderBy: { createdAt: 'desc' } } },
  });

  if (!client) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Редактировать: {client.name}</h1>
      <ClientForm
        locale={locale}
        initial={{ id: client.id, name: client.name, contactPerson: client.contactPerson }}
      />

      {client.campaigns.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Кампании клиента</h2>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--surface-2)]">
                  <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Название</th>
                  <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Статус</th>
                  <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Период</th>
                </tr>
              </thead>
              <tbody>
                {client.campaigns.map(c => (
                  <tr key={c.id} className="transition-colors hover:bg-[var(--surface-2)]">
                    <td className="border-b border-[var(--border)] px-4 py-3">
                      <Link href={`/${locale}/admin/campaigns/${c.id}`} className="text-sm font-medium hover:text-[var(--brand-primary)]">
                        {c.name}
                      </Link>
                    </td>
                    <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">{c.status}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                      {c.periodStart.toLocaleDateString('ru-RU')} — {c.periodEnd.toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
