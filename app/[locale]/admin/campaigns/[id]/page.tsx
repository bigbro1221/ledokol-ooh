import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { auth, isGoogleLinked } from '@/lib/auth';
import Link from 'next/link';
import { Upload, FileSpreadsheet, Layers, Pencil, Table2, Film, Eye, ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { StatusToggle } from '@/components/admin/status-toggle';
import { PeriodManager } from '@/components/admin/period-manager';
import { DeleteCampaignButton } from '@/components/admin/delete-campaign-button';
import { ClearScreensButton } from '@/components/admin/clear-screens-button';
import { CampaignFinancials } from '@/components/admin/campaign-financials';
import { RegeocodeButton } from '@/components/admin/regeocodebutton';

const TYPE_LABELS: Record<string, string> = {
  LED: 'LED экраны',
  STATIC: 'Статика',
  STOP: 'Остановки',
  AIRPORT: 'Аэропорт',
  BUS: 'Транспорт',
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const tCreatives = await getTranslations({ locale, namespace: 'creatives' });
  const tAdmin = await getTranslations({ locale, namespace: 'admin' });
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: true,
      screens: { select: { type: true } },
      periods: {
        include: { _count: { select: { metrics: true } } },
        orderBy: { periodStart: 'asc' },
      },
    },
    // yandexMapUrl is included automatically via include (all scalar fields)
  });

  if (!campaign) notFound();

  const byType: Record<string, number> = {};
  for (const s of campaign.screens) {
    byType[s.type] = (byType[s.type] || 0) + 1;
  }

  const totalScreens = campaign.screens.length;

  // Serialise periods (BigInt → number)
  const periods = campaign.periods.map(p => ({
    id: p.id,
    campaignId: p.campaignId,
    name: p.name,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    sourceFileUrl: p.sourceFileUrl,
    totalBudgetUzs: p.totalBudgetUzs ? Number(p.totalBudgetUzs) : null,
    productionCost: p.productionCost ? Number(p.productionCost) : null,
    agencyFeePct: Number(p.acRate) > 0 ? Number(p.acRate) * 100 : null,
    totalFinal: p.totalFinal ? Number(p.totalFinal) : null,
    _count: p._count,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/${locale}/admin/campaigns`}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            {tAdmin('campaigns')}
          </Link>
          <p className="text-xs text-[var(--text-3)]">{campaign.client.name}</p>
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link
            href={`/${locale}/dashboard?campaign=${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-subtle)] hover:text-[var(--brand-primary)]"
          >
            <Eye size={13} strokeWidth={1.5} /> {tAdmin('viewAsClient')}
          </Link>
          <Link
            href={`/${locale}/admin/campaigns/${id}/edit`}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <Pencil size={13} strokeWidth={1.5} /> Редактировать
          </Link>
          {!campaign.splitByPeriods && (
            <Link
              href={`/${locale}/admin/campaigns/${id}/upload`}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
            >
              <Upload size={16} strokeWidth={1.5} /> Загрузить XLSX
            </Link>
          )}
          {totalScreens > 0 && (
            <Link
              href={`/${locale}/admin/campaigns/${id}/screens`}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <Table2 size={13} strokeWidth={1.5} /> Поверхности
            </Link>
          )}
          <Link
            href={`/${locale}/admin/campaigns/${id}/creatives`}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <Film size={13} strokeWidth={1.5} /> {tCreatives('button')}
          </Link>
          {totalScreens > 0 && !campaign.splitByPeriods && (
            <ClearScreensButton campaignId={id} />
          )}
          {campaign.yandexMapUrl && totalScreens > 0 && (
            <RegeocodeButton campaignId={id} />
          )}
          <DeleteCampaignButton campaignId={id} locale={locale} />
        </div>
      </div>

      {/* Info cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="col-span-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-2 text-xs text-[var(--text-3)]">Статус</div>
          <StatusToggle campaignId={campaign.id} currentStatus={campaign.status} />
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--text-3)]">Период</div>
          <div className="mt-1 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
            {campaign.periodStart.toLocaleDateString('ru-RU')} — {campaign.periodEnd.toLocaleDateString('ru-RU')}
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--text-3)]">Поверхности</div>
          <div className="mt-1 text-2xl font-semibold">{totalScreens}</div>
        </div>

        {campaign.splitByPeriods ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--text-3)]">Месяцев</div>
            <div className="mt-1 flex items-center gap-2">
              <Layers size={18} className="text-[var(--brand-primary)]" strokeWidth={1.5} />
              <span className="text-2xl font-semibold">{campaign.periods.length}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--text-3)]">Бюджет (итого)</div>
            <div className="mt-1 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              {(() => {
                const v = campaign.totalFinal ?? campaign.totalBudgetUzs;
                return v ? `${Number(v).toLocaleString('ru-RU')} UZS` : '—';
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Periods section */}
      {campaign.splitByPeriods ? (
        <div className="mb-8">
          <h2 className="mb-3 text-[15px] font-semibold">Месяцы</h2>
          <PeriodManager
            campaignId={id}
            locale={locale}
            initialPeriods={periods}
            campaignStart={campaign.periodStart.toISOString()}
            campaignEnd={campaign.periodEnd.toISOString()}
          />
        </div>
      ) : (
        /* Mono campaign: screen breakdown + financials */
        <div className="space-y-6">
          {totalScreens > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-[15px] font-semibold">Поверхности по типам</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(byType).map(([type, count]) => (
                  <div key={type} className="rounded-[var(--radius-md)] bg-[var(--surface-2)] px-4 py-3">
                    <div className="text-lg font-semibold">{count}</div>
                    <div className="text-xs text-[var(--text-3)]">{TYPE_LABELS[type] || type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <CampaignFinancials
            campaignId={id}
            initialValues={{
              totalBudgetUzs: campaign.totalBudgetUzs ? Number(campaign.totalBudgetUzs) : null,
              productionCost: campaign.productionCost ? Number(campaign.productionCost) : null,
              agencyFeePct: Number(campaign.acRate) > 0 ? Number(campaign.acRate) * 100 : null,
              totalFinal: campaign.totalFinal ? Number(campaign.totalFinal) : null,
            }}
          />

          {totalScreens === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-12 text-center">
              <FileSpreadsheet size={40} className="text-[var(--text-4)]" strokeWidth={1.5} />
              <h3 className="text-lg font-medium" style={{ fontFamily: 'var(--font-display)' }}>Нет данных</h3>
              <p className="text-sm text-[var(--text-3)]">Загрузите XLSX медиаплан для этой кампании</p>
              <Link
                href={`/${locale}/admin/campaigns/${id}/upload`}
                className="mt-2 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
              >
                Загрузить XLSX
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
