'use client';

import dynamic from 'next/dynamic';
import { Monitor, LayoutGrid, Target, Banknote } from 'lucide-react';
import { KPICard } from '@/components/charts/kpi-card';
import { ImpressionsDonut } from '@/components/charts/impressions-donut';
import { TopScreensBar } from '@/components/charts/top-screens-bar';
import { ScreensTable } from '@/components/charts/screens-table';
import { CityBreakdown } from '@/components/charts/city-breakdown';
import { PlanFactBar } from '@/components/charts/plan-fact-bar';
import { PlanFactBreakdown } from '@/components/charts/plan-fact-breakdown';
import { BudgetByType } from '@/components/charts/budget-by-type';
import { EfficiencyStrip } from '@/components/charts/efficiency-strip';
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
  kpis: { totalOtsPlan: number; totalOtsFact: number; totalScreens: number; cities: number; totalBudget: number; formatBudget: string };
  donutData: { name: string; value: number }[];
  budgetByType: { name: string; value: number }[];
  totalBudgetFromScreens: number;
  planVsFactByCity: { label: string; plan: number; fact: number }[];
  planVsFactByType: { label: string; plan: number; fact: number }[];
  topScreens: { address: string; ots: number }[];
  tableScreens: { id: string; externalId: string | null; type: string; city: string; address: string; size: string | null; photoUrl: string | null; ots: number | null }[];
  mapScreens: { id: string; lat: number; lng: number; type: string; address: string; city: string; size: string | null; ots: number | null; otsFact: number | null; photoUrl: string | null }[];
  cityBreakdown: { city: string; screens: number; ots: number }[];
  allCities: string[];
  filters: { city: string; type: string };
  heatmapEmbedUrl: string | null;
}

export function DashboardClient({
  locale, campaigns, selectedCampaignId, campaign, kpis,
  donutData, budgetByType, totalBudgetFromScreens,
  planVsFactByCity, planVsFactByType,
  topScreens, tableScreens, mapScreens, cityBreakdown, allCities, filters,
  heatmapEmbedUrl,
}: Props) {
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);
  const hasFact = kpis.totalOtsFact > 0;
  // "Всего показов" — prefer fact when available, fall back to plan
  const impressionsValue = hasFact ? kpis.totalOtsFact : kpis.totalOtsPlan;
  const impressionsLabel = hasFact ? 'Показы (факт)' : 'Показы (план)';
  // Completion %
  const completionPct = kpis.totalOtsPlan > 0 && hasFact
    ? Math.round((kpis.totalOtsFact / kpis.totalOtsPlan) * 100)
    : null;
  const completionDir = completionPct === null
    ? 'neutral'
    : completionPct >= 100 ? 'up' : completionPct < 80 ? 'down' : 'neutral';
  const completionTrend = completionPct === null
    ? 'Нет факт. данных'
    : completionPct >= 100 ? 'Выше плана'
    : completionPct >= 80  ? 'В процессе'
    :                        'Ниже плана';

  // Budget source: use screen-level sum if no explicit campaign total; else prefer campaign total
  const budgetForWidgets = kpis.totalBudget > 0 ? kpis.totalBudget : totalBudgetFromScreens;

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
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label={impressionsLabel}
          value={impressionsValue.toLocaleString('ru-RU')}
          trend={hasFact
            ? { label: `План: ${kpis.totalOtsPlan.toLocaleString('ru-RU')}`, direction: 'neutral' }
            : { label: 'OTS план', direction: 'neutral' }}
          icon={<Monitor size={14} strokeWidth={1.5} />}
          delay={0}
        />
        <KPICard
          label="Поверхности"
          value={String(kpis.totalScreens)}
          unit="экр."
          trend={{ label: `${kpis.cities} гор.`, direction: 'neutral' }}
          icon={<LayoutGrid size={14} strokeWidth={1.5} />}
          delay={80}
        />
        <KPICard
          label="Выполнение"
          value={completionPct !== null ? String(completionPct) : '—'}
          unit={completionPct !== null ? '%' : undefined}
          trend={{ label: completionTrend, direction: completionDir }}
          icon={<Target size={14} strokeWidth={1.5} />}
          delay={160}
        />
        <KPICard
          label="Бюджет"
          value={kpis.formatBudget}
          unit="UZS"
          icon={<Banknote size={14} strokeWidth={1.5} />}
          delay={240}
        />
      </div>

      {/* Efficiency strip — CPM, avg OTS/screen, avg budget/screen */}
      <div className="mb-6">
        <EfficiencyStrip
          totalBudget={budgetForWidgets}
          totalOtsPlan={kpis.totalOtsPlan}
          totalOtsFact={kpis.totalOtsFact}
          totalScreens={kpis.totalScreens}
          totalCities={kpis.cities}
        />
      </div>

      {/* Row: Plan/Fact overall bar + OTS-by-type donut */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlanFactBar plan={kpis.totalOtsPlan} fact={kpis.totalOtsFact} />
        {donutTotal > 0 && <ImpressionsDonut data={donutData} total={donutTotal} />}
      </div>

      {/* Row: Plan vs Fact by Type + Budget by Type donut */}
      {(planVsFactByType.length > 0 || budgetByType.length > 0) && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {planVsFactByType.length > 0 && (
            <PlanFactBreakdown
              title="План и факт по типам"
              subtitle="Сравнение плановых и фактических показов"
              data={planVsFactByType}
            />
          )}
          {budgetByType.length > 0 && (
            <BudgetByType data={budgetByType} total={totalBudgetFromScreens} />
          )}
        </div>
      )}

      {/* Plan vs Fact by City — full width since cities can be many */}
      {planVsFactByCity.length > 0 && (
        <div className="mb-6">
          <PlanFactBreakdown
            title="План и факт по городам"
            subtitle="Выполнение плана в разрезе городов"
            data={planVsFactByCity}
          />
        </div>
      )}

      {/* Map */}
      <div className="mb-6">
        <ScreenMap screens={mapScreens} />
      </div>

      {/* Heatmap (Foursquare Studio) */}
      {heatmapEmbedUrl && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">Тепловая карта аудитории</h2>
            <a
              href={heatmapEmbedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[var(--text-3)] underline hover:text-[var(--text)]"
            >
              Открыть в новой вкладке ↗
            </a>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]" style={{ height: 480 }}>
            <iframe
              src={heatmapEmbedUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="fullscreen; geolocation"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Heatmap"
            />
          </div>
        </div>
      )}

      {/* Row: City breakdown + Top screens */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CityBreakdown data={cityBreakdown} />
        {topScreens.length > 0 && <TopScreensBar data={topScreens} />}
      </div>

      {/* Screens Table */}
      <ScreensTable screens={tableScreens} />
    </>
  );
}
