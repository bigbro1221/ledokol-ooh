import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LayoutGrid, Banknote, Eye, MapPin } from 'lucide-react';
import { KPICard } from '@/components/charts/kpi-card';
import { type DateFormat, formatCampaignPeriod } from '@/lib/format-period';

interface Row {
  id: string;
  name: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  budget: number;
  screensCount: number;
  otsPlan: number;
}

function fmtBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('ru-RU');
}

export async function CampaignsListView({
  rows,
  locale,
  dateFormat,
}: {
  rows: Row[];
  locale: string;
  dateFormat: DateFormat;
}) {
  const tc = await getTranslations({ locale, namespace: 'campaignsPage' });
  const tStatus = await getTranslations({ locale, namespace: 'campaignStatus' });

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-[28px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>{tc('emptyTitle')}</h2>
        <p className="mt-3 text-sm text-[var(--text-3)]">{tc('emptyHint')}</p>
      </div>
    );
  }

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalScreens = rows.reduce((s, r) => s + r.screensCount, 0);
  const totalOts = rows.reduce((s, r) => s + r.otsPlan, 0);
  const activeCount = rows.filter(r => r.status === 'ACTIVE').length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {tc('title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">{tc('subtitle')}</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label={tc('kpiTotalBudget')} value={fmtBig(totalBudget)} unit="UZS" icon={<Banknote size={16} strokeWidth={1.5} />} />
        <KPICard label={tc('kpiTotalScreens')} value={totalScreens.toLocaleString('ru-RU')} unit={tc('kpiScreensUnit')} icon={<LayoutGrid size={16} strokeWidth={1.5} />} />
        <KPICard label={tc('kpiTotalOts')} value={fmtBig(totalOts)} unit={tc('kpiOtsUnit')} icon={<Eye size={16} strokeWidth={1.5} />} />
        <KPICard label={tc('kpiActiveCampaigns')} value={activeCount.toLocaleString('ru-RU')} unit={tc('kpiActiveUnit')} icon={<MapPin size={16} strokeWidth={1.5} />} />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {rows.map(r => {
          const period = formatCampaignPeriod(r.periodStart, r.periodEnd, locale, dateFormat);
          const isActive = r.status === 'ACTIVE';
          return (
            <Link
              key={r.id}
              href={`/${locale}/dashboard?campaign=${r.id}`}
              className="group relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-md)]"
            >
              {isActive && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--success)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  {tStatus(r.status)}
                </span>
              )}
              <h3 className="pr-16 text-[16px] font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--brand-primary)]">
                {r.name}
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {period}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
                <Stat label={tc('colScreens')} value={r.screensCount.toLocaleString('ru-RU')} />
                <Stat label={tc('colOts')} value={fmtBig(r.otsPlan)} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{value}</p>
    </div>
  );
}
