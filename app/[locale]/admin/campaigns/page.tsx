import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-[rgba(16,185,129,0.12)] text-[var(--success)]',
  PAUSED: 'bg-[rgba(234,179,8,0.12)] text-[var(--warning)]',
  COMPLETED: 'bg-[var(--surface-3)] text-[var(--text-3)]',
  DRAFT: 'bg-[var(--surface-3)] text-[var(--text-3)]',
};

export default async function CampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const campaigns = await prisma.campaign.findMany({
    include: {
      client: { select: { name: true } },
      _count: { select: { screens: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Кампании</h1>
        <Link
          href={`/${locale}/admin/campaigns/new`}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
        >
          <Plus size={16} strokeWidth={1.5} /> Новая кампания
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Название</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Клиент</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Статус</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Период</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Поверхности</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(c => (
              <tr key={c.id} className="transition-colors hover:bg-[var(--surface-2)]">
                <td className="border-b border-[var(--border)] px-4 py-3">
                  <Link href={`/${locale}/admin/campaigns/${c.id}`} className="text-sm font-medium hover:text-[var(--brand-primary)]">
                    {c.name}
                  </Link>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">{c.client.name}</td>
                <td className="border-b border-[var(--border)] px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ${STATUS_STYLES[c.status] || ''}`}>
                    {c.status}
                  </span>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                  {c.periodStart.toLocaleDateString('ru-RU')} — {c.periodEnd.toLocaleDateString('ru-RU')}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-right text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                  {c._count.screens}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--text-3)]">
                  Нет кампаний. Создайте первую.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
