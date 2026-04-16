import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Building2, Megaphone, Monitor, Users, Plus, Upload } from 'lucide-react';

export default async function AdminOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const [clientCount, campaignCount, screenCount, userCount, activeCampaigns, recentCampaigns] = await Promise.all([
    prisma.client.count(),
    prisma.campaign.count(),
    prisma.screen.count(),
    prisma.user.count(),
    prisma.campaign.count({ where: { status: 'ACTIVE' } }),
    prisma.campaign.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, status: true, updatedAt: true, client: { select: { name: true } }, _count: { select: { screens: true } } },
    }),
  ]);

  const stats = [
    { label: 'Клиенты', value: clientCount, icon: Building2, href: `/${locale}/admin/clients` },
    { label: 'Кампании', value: campaignCount, icon: Megaphone, href: `/${locale}/admin/campaigns`, sub: `${activeCampaigns} активных` },
    { label: 'Поверхности', value: screenCount, icon: Monitor, href: `/${locale}/admin/campaigns` },
    { label: 'Пользователи', value: userCount, icon: Users, href: `/${locale}/admin/users` },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Обзор</h1>
        <div className="flex gap-2">
          <Link
            href={`/${locale}/admin/clients/new`}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--surface-2)]"
          >
            <Plus size={14} strokeWidth={1.5} /> Клиент
          </Link>
          <Link
            href={`/${locale}/admin/campaigns/new`}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
          >
            <Plus size={14} strokeWidth={1.5} /> Кампания
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-sm)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">{s.label}</span>
              <s.icon size={16} strokeWidth={1.5} className="text-[var(--text-4)]" />
            </div>
            <div className="text-2xl font-semibold">{s.value}</div>
            {s.sub && <div className="mt-1 text-xs text-[var(--text-3)]">{s.sub}</div>}
          </Link>
        ))}
      </div>

      {/* Recent campaigns */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-[15px] font-semibold">Последние кампании</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {recentCampaigns.map(c => (
            <Link
              key={c.id}
              href={`/${locale}/admin/campaigns/${c.id}`}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]"
            >
              <div className="flex-1">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-[var(--text-3)]">{c.client.name}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                c.status === 'ACTIVE' ? 'bg-[rgba(16,185,129,0.12)] text-[var(--success)]'
                : c.status === 'DRAFT' ? 'bg-[var(--surface-3)] text-[var(--text-3)]'
                : 'bg-[var(--surface-3)] text-[var(--text-3)]'
              }`}>
                {c.status}
              </span>
              <span className="text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {c._count.screens} экр.
              </span>
              <Upload size={14} className="text-[var(--text-4)]" />
            </Link>
          ))}
          {recentCampaigns.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--text-3)]">Нет кампаний</div>
          )}
        </div>
      </div>
    </div>
  );
}
