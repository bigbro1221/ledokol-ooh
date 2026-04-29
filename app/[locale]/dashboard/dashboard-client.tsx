'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { LayoutGrid, Banknote, MapPin, ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react';
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
import { PeriodFilter } from '@/components/ui/period-filter';
import { PeriodRangeSelector } from '@/components/ui/period-range-selector';
import { type DateFormat, formatCampaignPeriod } from '@/lib/format-period';
import { useTranslations } from 'next-intl';
import { CreativesCard, type CreativeView } from '@/components/dashboard/creatives-card';

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
function citiesNoun(n: number, locale: string, t: (key: string) => string): string {
  if (locale === 'ru') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return t('cityMany');
    if (mod10 === 1) return t('cityOne');
    if (mod10 >= 2 && mod10 <= 4) return t('cityFew');
    return t('cityMany');
  }
  return n === 1 ? t('cityOne') : t('cityMany');
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
  availableTypes: string[];
  filters: { city: string; type: string };
  heatmapEmbedUrl: string | null;
  reportsUrl: string | null;
  periodsWithData: { id: string; name: string }[];
  selectedFrom: string | null;
  selectedTo: string | null;
  creatives: CreativeView[];
}

export function DashboardClient({
  locale, initialDateFormat, campaigns, selectedCampaignId, campaign, kpis,
  budgetByType, totalBudgetFromScreens,
  planVsFactByCity, monthlyByCity, planVsFactByType,
  topScreens, tableScreens, campaignPeriods, mapScreens, cityBreakdown, allCities, availableTypes, filters,
  heatmapEmbedUrl, reportsUrl, periodsWithData, selectedFrom, selectedTo, creatives,
}: Props) {
  const [monthlyExpanded, setMonthlyExpanded] = useState(false);
  const td = useTranslations('dashboard');
  const tStatus = useTranslations('campaignStatus');
  const tc = useTranslations('charts');

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

      {/* Campaign Selector + Period Range Selector */}
      {(campaigns.length > 1 || periodsWithData.length >= 2) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {campaigns.length > 1 && (
            <CampaignSelector campaigns={campaigns} currentId={selectedCampaignId} locale={locale} dateFormat={initialDateFormat} />
          )}
          {periodsWithData.length >= 2 && (
            <PeriodRangeSelector periods={periodsWithData} locale={locale} selectedFrom={selectedFrom} selectedTo={selectedTo} />
          )}
        </div>
      )}

      {/* Period chips */}
      {periodsWithData.length >= 2 && (
        <PeriodFilter periods={periodsWithData} locale={locale} selectedFrom={selectedFrom} selectedTo={selectedTo} />
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
              {tStatus(campaign.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Filters + reports link */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterBar cities={allCities} availableTypes={availableTypes} locale={locale} />
        {reportsUrl && (
          <a
            href={reportsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-3.5 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)] sm:text-[11px]"
          >
            <FileText size={14} strokeWidth={1.75} />
            {td('reports')}
            <ExternalLink size={11} strokeWidth={1.75} className="opacity-80" />
          </a>
        )}
      </div>
      {(filters.city || filters.type) && (
        <p className="mb-4 text-xs text-[var(--text-3)]">
          {td('showingLabel')} {filters.city || td('allCities')}, {filters.type || td('allTypes')} — {kpis.totalScreens} {td('screensSuffix')}
        </p>
      )}

      {/* Creatives — campaign media, sits between filters and KPIs */}
      <CreativesCard creatives={creatives} />

      {/* KPI Cards — 3 visible cards (Performance disabled) */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {/* Geography */}
        <KPICard
          label={td('geography')}
          value={String(kpis.cities)}
          unit={citiesNoun(kpis.cities, locale, td)}
          icon={<MapPin size={14} strokeWidth={1.5} />}
          delay={0}
        />
        {/* Surfaces */}
        <KPICard
          label={td('screens')}
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
          label={td('budgetWithFees')}
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
              title={tc('planTitle')}
              subtitle={tc('planSubtitle')}
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
            title={tc('planCitiesTitle')}
            subtitle={tc('planCitiesSubtitle')}
            data={planVsFactByCity}
          />

          {monthlyByCity.length > 0 && (
            <>
              <button
                onClick={() => setMonthlyExpanded(v => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] py-3 text-[13px] text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                {monthlyExpanded
                  ? <><ChevronUp size={15} strokeWidth={1.5} /> {td('hideMonthlyBreakdown')}</>
                  : <><ChevronDown size={15} strokeWidth={1.5} /> {td('showMonthlyBreakdown')}</>
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
        <div className="mb-6 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">{td('heatmapTitle')}</h3>
              <p className="mt-0.5 text-xs text-[var(--text-3)]">Foursquare Studio</p>
            </div>
            <a
              href={heatmapEmbedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[var(--text-3)] underline hover:text-[var(--text)]"
            >
              {td('heatmapOpenNewTab')}
            </a>
          </div>
          <iframe
            src={heatmapEmbedUrl}
            style={{ width: '100%', height: 480, border: 'none', display: 'block' }}
            allow="fullscreen; geolocation"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Heatmap"
          />
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
