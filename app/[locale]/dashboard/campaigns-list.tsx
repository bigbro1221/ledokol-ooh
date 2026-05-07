import { getTranslations } from 'next-intl/server';
import { LayoutGrid, Banknote, Eye, MapPin } from 'lucide-react';
import { KPICard } from '@/components/charts/kpi-card';
import { type DateFormat } from '@/lib/format-period';
import { TileGrid, type TileGridRow } from './tile-grid';

interface Row extends TileGridRow {
  budget: number;
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
        <KPICard label={tc('kpiTotalBudget')} value={fmtBig(totalBudget)} unit="UZS" icon={<Banknote size={16} strokeWidth={1.5} />} gradient="warm" />
        <KPICard label={tc('kpiTotalScreens')} value={totalScreens.toLocaleString('ru-RU')} unit={tc('kpiScreensUnit')} icon={<LayoutGrid size={16} strokeWidth={1.5} />} gradient="default" />
        <KPICard label={tc('kpiTotalOts')} value={fmtBig(totalOts)} unit={tc('kpiOtsUnit')} icon={<Eye size={16} strokeWidth={1.5} />} gradient="warm" />
        <KPICard label={tc('kpiActiveCampaigns')} value={activeCount.toLocaleString('ru-RU')} unit={tc('kpiActiveUnit')} icon={<MapPin size={16} strokeWidth={1.5} />} gradient="default" />
      </div>

      <TileGrid rows={rows} locale={locale} dateFormat={dateFormat} />
    </div>
  );
}
