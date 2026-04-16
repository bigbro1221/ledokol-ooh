'use client';

import dynamic from 'next/dynamic';
import { Monitor, LayoutGrid, Target, Banknote } from 'lucide-react';
import { KPICard } from '@/components/charts/kpi-card';
import { ImpressionsDonut } from '@/components/charts/impressions-donut';
import { ImpressionsArea } from '@/components/charts/impressions-area';
import { HourlyChart } from '@/components/charts/hourly-chart';
import { TopScreensBar } from '@/components/charts/top-screens-bar';
import { ScreensTable } from '@/components/charts/screens-table';
import { CityBreakdown } from '@/components/charts/city-breakdown';
import { BudgetBar } from '@/components/charts/budget-bar';
import { CampaignSelector } from '@/components/ui/campaign-selector';
import { FilterBar } from '@/components/ui/filter-bar';

const ScreenMap = dynamic(() => import('@/components/map/screen-map').then(m => ({ default: m.ScreenMap })), {
  ssr: false,
  loading: () => <div className="h-[400px] rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] animate-pulse" />,
});

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-[rgba(16,185,129,0.12)] text-[var(--success)]',
  PAUSED: 'bg-[rgba(234,179,8,0.12)] text-[var(--warning)]',
  COMPLETED: 'bg-[var(--surface-3)] text-[var(--text-3)]',
  DRAFT: 'bg-[var(--surface-3)] text-[var(--text-3)]',
};
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Активна', PAUSED: 'Пауза', COMPLETED: 'Завершена', DRAFT: 'Черновик' };

interface Props {
  locale: string;
  campaigns: { id: string; name: string; status: string }[];
  selectedCampaignId: string;
  campaign: { name: string; clientName: string; period: string; status: string };
  kpis: { totalOts: number; totalScreens: number; cities: number; totalBudget: number; formatBudget: string };
  donutData: { name: string; value: number }[];
  dailyImpressions: { date: string; impressions: number }[];
  hourlyData: { hour: string; impressions: number }[];
  topScreens: { address: string; ots: number }[];
  tableScreens: { id: string; externalId: string | null; type: string; city: string; address: string; size: string | null; photoUrl: string | null; ots: number | null }[];
  mapScreens: { id: string; lat: number; lng: number; type: string; address: string; city: string; size: string | null; ots: number | null; photoUrl: string | null }[];
  cityBreakdown: { city: string; screens: number; ots: number }[];
  allCities: string[];
  filters: { city: string; type: string };
}

export function DashboardClient({
  locale, campaigns, selectedCampaignId, campaign, kpis,
  donutData, dailyImpressions, hourlyData, topScreens,
  tableScreens, mapScreens, cityBreakdown, allCities, filters,
}: Props) {
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Campaign Selector */}
      {campaigns.length > 1 && (
        <div className="mb-4">
          <CampaignSelector campaigns={campaigns} currentId={selectedCampaignId} locale={locale} />
        </div>
      )}

      {/* Campaign Hero */}
      <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{campaign.clientName}</span>
          <h1 className="text-[28px] font-medium leading-[1.1] tracking-tight sm:text-[40px]" style={{ fontFamily: 'var(--font-display)' }}>
            {campaign.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${STATUS_STYLES[campaign.status]}`}>
              {campaign.status === 'ACTIVE' && <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />}
              {STATUS_LABELS[campaign.status]}
            </span>
            <span className="text-[13px] text-[var(--text-2)]" style={{ fontFamily: 'var(--font-mono)' }}>{campaign.period}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterBar cities={allCities} locale={locale} />
      {(filters.city || filters.type) && (
        <p className="mb-4 text-xs text-[var(--text-3)]">
          Показаны: {filters.city || 'все города'}, {filters.type || 'все типы'} — {kpis.totalScreens} поверхностей
        </p>
      )}

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Всего показов" value={kpis.totalOts.toLocaleString('ru-RU')} trend={{ label: 'OTS', direction: 'neutral' }} icon={<Monitor size={14} strokeWidth={1.5} />} delay={0} />
        <KPICard label="Поверхности" value={String(kpis.totalScreens)} unit="экр." trend={{ label: `${kpis.cities} гор.`, direction: 'neutral' }} icon={<LayoutGrid size={14} strokeWidth={1.5} />} delay={80} />
        <KPICard label="Выполнение" value="101" unit="%" trend={{ label: 'Выше плана', direction: 'up' }} icon={<Target size={14} strokeWidth={1.5} />} delay={160} />
        <KPICard label="Бюджет" value={kpis.formatBudget} unit="UZS" icon={<Banknote size={14} strokeWidth={1.5} />} delay={240} />
      </div>

      {/* Row: Budget bar + Donut */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kpis.totalBudget > 0 && <BudgetBar total={kpis.totalBudget} spent={kpis.totalBudget * 0.7} />}
        <ImpressionsDonut data={donutData} total={donutTotal} />
      </div>

      {/* Row: Area + Hourly */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ImpressionsArea data={dailyImpressions} />
        <HourlyChart data={hourlyData} />
      </div>

      {/* Map */}
      <div className="mb-6">
        <ScreenMap screens={mapScreens} />
      </div>

      {/* Row: City breakdown + Top screens */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CityBreakdown data={cityBreakdown} />
        <TopScreensBar data={topScreens} />
      </div>

      {/* Screens Table */}
      <ScreensTable screens={tableScreens} />
    </>
  );
}
