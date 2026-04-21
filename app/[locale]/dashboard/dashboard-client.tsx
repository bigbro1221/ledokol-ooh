'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { LayoutGrid, Banknote, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { KPICard } from '@/components/charts/kpi-card';
// TODO: disabled per product decision 2026-04-20; restore if re-enabled
// import { ImpressionsDonut } from '@/components/charts/impressions-donut';
import { TopScreensBar } from '@/components/charts/top-screens-bar';
import { ScreensTable, type ScreenRow } from '@/components/screens/screens-table';
// TODO: disabled per product decision 2026-04-21; restore if re-enabled
// import { CityBreakdown } from '@/components/charts/city-breakdown';
// TODO: disabled per product decision 2026-04-20; restore if re-enabled
// import { PlanFactBar } from '@/components/charts/plan-fact-bar';
import { PlanFactBreakdown } from '@/components/charts/plan-fact-breakdown';
import { MonthlyPlanFact, type CityMonthlyData } from '@/components/charts/monthly-plan-fact';
import { BudgetByType } from '@/components/charts/budget-by-type';
import { EfficiencyStrip } from '@/components/charts/efficiency-strip';
import { CampaignSelector } from '@/components/ui/campaign-selector';
import { FilterBar } from '@/components/ui/filter-bar';
import { type DateFormat, formatCampaignPeriod } from '@/lib/format-period';

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

const BUDGET_LABEL: Record<string, string> = {
  ru: 'Бюджет с учётом АК/НДС',
  en: 'Budget (incl. AC/VAT)',
  uz: 'Byudjet (AK va QQS bilan)',
  tr: 'Bütçe (AK/KDV dahil)',
};
const GEOGRAPHY_LABEL: Record<string, string> = {
  ru: 'География',
  en: 'Geography',
  uz: 'Geografiya',
  tr: 'Coğrafya',
};

function citiesNoun(n: number, locale: string): string {
  if (locale === 'en') return n === 1 ? 'city' : 'cities';
  if (locale === 'uz') return 'shahar';
  if (locale === 'tr') return n === 1 ? 'şehir' : 'şehir';
  // Russian declension
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'городов';
  if (mod10 === 1) return 'город';
  if (mod10 >= 2 && mod10 <= 4) return 'города';
  return 'городов';
}

interface Props {
  locale: string;
  initialDateFormat: DateFormat;
  campaigns: { id: string; name: string; status: string; clientName: string; periodStart: string; periodEnd: string }[];
  selectedCampaignId: string;
  campaign: { name: string; clientName: string; periodStart: string; periodEnd: string; status: string };
  kpis: { totalOtsPlan: number; totalOtsFact: number; totalScreens: number; cities: number; totalBudget: number; formatBudget: string };
  // TODO: disabled per product decision 2026-04-20; restore if re-enabled
  // donutData: { name: string; value: number }[];
  // donutIsFact: boolean;
  budgetByType: { name: string; value: number; count: number }[];
  totalBudgetFromScreens: number;
  planVsFactByCity: { label: string; plan: number; fact: number }[];
  monthlyByCity: CityMonthlyData[];
  planVsFactByType: { label: string; plan: number; fact: number }[];
  topScreens: { address: string; ots: number }[];
  tableScreens: ScreenRow[];
  campaignPeriods: { id: string; name: string }[];
  mapScreens: { id: string; lat: number; lng: number; type: string; address: string; city: string; size: string | null; ots: number | null; otsFact: number | null; photoUrl: string | null }[];
  cityBreakdown: { city: string; screens: number; ots: number }[];
  allCities: string[];
  filters: { city: string; type: string };
  heatmapEmbedUrl: string | null;
}

export function DashboardClient({
  locale, initialDateFormat, campaigns, selectedCampaignId, campaign, kpis,
  budgetByType, totalBudgetFromScreens,
  planVsFactByCity, monthlyByCity, planVsFactByType,
  topScreens, tableScreens, campaignPeriods, mapScreens, cityBreakdown, allCities, filters,
  heatmapEmbedUrl,
}: Props) {
  const [monthlyExpanded, setMonthlyExpanded] = useState(false);

  const formattedPeriod = formatCampaignPeriod(
    new Date(campaign.periodStart),
    new Date(campaign.periodEnd),
    locale,
    initialDateFormat,
  );

  // TODO: disabled per product decision 2026-04-20; restore if re-enabled
  // const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // Budget source: use screen-level sum if no explicit campaign total; else prefer campaign total
  const budgetForWidgets = kpis.totalBudget > 0 ? kpis.totalBudget : totalBudgetFromScreens;

  return (
    <>
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Campaign Selector */}
      {campaigns.length > 1 && (
        <div className="mb-4">
          <CampaignSelector campaigns={campaigns} currentId={selectedCampaignId} locale={locale} dateFormat={initialDateFormat} />
        </div>
      )}

      {/* Campaign Hero */}
      <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="flex flex-col gap-2">
          <h1
            className="text-[28px] font-medium leading-[1.1] tracking-tight sm:text-[40px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {campaign.clientName}. {formattedPeriod}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${STATUS_STYLES[campaign.status]}`}>
              {campaign.status === 'ACTIVE' && <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />}
              {STATUS_LABELS[campaign.status]}
            </span>
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

      {/* KPI Cards — 3 visible cards (Performance disabled) */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {/* Geography */}
        <KPICard
          label={GEOGRAPHY_LABEL[locale] ?? GEOGRAPHY_LABEL.ru}
          value={String(kpis.cities)}
          unit={citiesNoun(kpis.cities, locale)}
          icon={<MapPin size={14} strokeWidth={1.5} />}
          delay={0}
        />
        {/* Surfaces */}
        <KPICard
          label="Поверхности"
          value={String(kpis.totalScreens)}
          icon={<LayoutGrid size={14} strokeWidth={1.5} />}
          delay={80}
        />
        {/* TODO: disabled per product decision 2026-04-20; restore if re-enabled
        <KPICard
          label="Выполнение"
          value={completionPct !== null ? String(completionPct) : '—'}
          unit={completionPct !== null ? '%' : undefined}
          trend={{ label: completionTrend, direction: completionDir }}
          icon={<Target size={14} strokeWidth={1.5} />}
          delay={160}
        />
        */}
        {/* Budget */}
        <KPICard
          label={BUDGET_LABEL[locale] ?? BUDGET_LABEL.ru}
          value={kpis.formatBudget}
          unit="UZS"
          icon={<Banknote size={14} strokeWidth={1.5} />}
          delay={160}
        />
      </div>

      {/* Efficiency strip — CPM, avg OTS/screen, avg budget/screen, avg impressions/day */}
      <div className="mb-6">
        <EfficiencyStrip
          totalBudget={budgetForWidgets}
          totalOtsPlan={kpis.totalOtsPlan}
          totalOtsFact={kpis.totalOtsFact}
          totalScreens={kpis.totalScreens}
          periodStart={campaign.periodStart}
          periodEnd={campaign.periodEnd}
          status={campaign.status}
          locale={locale}
        />
      </div>

      {/* TODO: disabled per product decision 2026-04-20; restore if re-enabled
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlanFactBar plan={kpis.totalOtsPlan} fact={kpis.totalOtsFact} />
        {donutTotal > 0 && <ImpressionsDonut data={donutData} total={donutTotal} isFact={donutIsFact} />}
      </div>
      */}

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
            <BudgetByType data={budgetByType} total={kpis.totalBudget > 0 ? kpis.totalBudget : totalBudgetFromScreens} />
          )}
        </div>
      )}

      {/* Plan vs Fact by City + monthly drill-down */}
      {planVsFactByCity.length > 0 && (
        <div className="mb-6 space-y-3">
          <PlanFactBreakdown
            title="План и факт по городам"
            subtitle="Выполнение плана в разрезе городов"
            data={planVsFactByCity}
          />

          {monthlyByCity.length > 0 && (
            <>
              <button
                onClick={() => setMonthlyExpanded(v => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] py-3 text-[13px] text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                {monthlyExpanded
                  ? <><ChevronUp size={15} strokeWidth={1.5} /> Скрыть помесячную разбивку</>
                  : <><ChevronDown size={15} strokeWidth={1.5} /> Показать помесячную разбивку</>
                }
              </button>

              {monthlyExpanded && (
                <MonthlyPlanFact data={monthlyByCity} />
              )}
            </>
          )}
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

      {/* Top screens */}
      {topScreens.length > 0 && (
        <div className="mb-6">
          <TopScreensBar data={topScreens} />
        </div>
      )}

      {/* Screens Table */}
      <div className="mb-6">
        <ScreensTable
          campaignId={selectedCampaignId}
          locale={(locale === 'en' || locale === 'uz') ? locale : 'ru'}
          screens={tableScreens}
          periods={campaignPeriods}
          editable={false}
        />
      </div>
    </>
  );
}
