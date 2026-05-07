'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronUp, FileText, ExternalLink } from 'lucide-react';
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
import { type DateFormat } from '@/lib/format-period';
import { useTranslations } from 'next-intl';
import { type CreativeView } from '@/components/dashboard/creatives-card';
import { CampaignHero } from '@/components/dashboard/campaign-hero';
import { ReachCard } from '@/components/dashboard/reach-card';

const ScreenMap = dynamic(() => import('@/components/map/screen-map').then(m => ({ default: m.ScreenMap })), {
  ssr: false,
  loading: () => <div className="h-[400px] rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] animate-pulse" />,
});

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
  userRole: string;
  initialDateFormat: DateFormat;
  campaigns: { id: string; name: string; status: string; periodStart: string; periodEnd: string; groupId: string | null; groupName: string | null }[];
  selectedCampaignId: string;
  campaign: { name: string; clientName: string; periodStart: string; periodEnd: string; status: string };
  kpis: { totalOtsPlan: number; totalOtsFact: number; totalRatingFact: number; avgImpressionsPerDay: number | null; totalScreens: number; cities: number; totalBudget: number; totalBudgetWithoutVat: number; formatBudget: string };
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
  filters: { cities: string[]; types: string[] };
  heatmapEmbedUrl: string | null;
  reportsUrl: string | null;
  hasYandexMap: boolean;
  periodsWithData: { id: string; name: string }[];
  selectedPeriods: string[];
  creatives: CreativeView[];
  reachEntries: { id: string; n: number; plan: number | null; fact: number | null; pinned: boolean }[];
  reachAudience: string | null;
}

export function DashboardClient({
  locale, userRole, initialDateFormat, campaigns, selectedCampaignId, campaign, kpis,
  budgetByType, totalBudgetFromScreens,
  planVsFactByCity, monthlyByCity, planVsFactByType,
  topScreens, tableScreens, campaignPeriods, mapScreens, cityBreakdown, allCities, availableTypes, filters,
  heatmapEmbedUrl, reportsUrl, hasYandexMap, periodsWithData, selectedPeriods, creatives,
  reachEntries, reachAudience,
}: Props) {
  const isClient = userRole === 'CLIENT';
  const [monthlyExpanded, setMonthlyExpanded] = useState(false);
  const td = useTranslations('dashboard');
  const tStatus = useTranslations('campaignStatus');
  const tc = useTranslations('charts');
  const tCreatives = useTranslations('creatives');

  // TODO: disabled per product decision 2026-04-20; restore if re-enabled
  // const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // The selector now shows only siblings of the current campaign within the
  // same project. If the current campaign isn't in a project (or has no
  // siblings), the selector is hidden entirely.
  const currentCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const projectSiblings = currentCampaign?.groupId
    ? campaigns.filter(c => c.groupId === currentCampaign.groupId)
    : [];
  const showSelector = !isClient && projectSiblings.length > 1;

  return (
    <>
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Top row: back-to-list link (CLIENT) or project-sibling selector (ADMIN) + reports button */}
      {(isClient || showSelector || reportsUrl) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {/* Wrapper is full-width on small mobile so the selector can claim
              the whole row. On sm+ it shrinks to content and sits left of
              the reports button as before. */}
          <div className="flex w-full items-center gap-2 [@media(min-width:500px)]:w-auto">
            {isClient ? (
              <Link
                href={`/${locale}/dashboard`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-hi)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <ChevronLeft size={14} strokeWidth={1.75} />
                {td('allCampaigns')}
              </Link>
            ) : (
              showSelector && (
                <CampaignSelector campaigns={projectSiblings} currentId={selectedCampaignId} locale={locale} dateFormat={initialDateFormat} />
              )
            )}
          </div>
          {reportsUrl && (
            <a
              href={reportsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)]"
            >
              <FileText size={14} strokeWidth={1.75} />
              {td('reports')}
              <ExternalLink size={11} strokeWidth={1.75} className="opacity-80" />
            </a>
          )}
        </div>
      )}

      {/* Campaign Hero — title, status, inline stats, creatives */}
      <CampaignHero
        eyebrow={td('campaignEyebrow')}
        title={campaign.name}
        status={campaign.status}
        statusLabel={tStatus(campaign.status)}
        stats={[
          {
            value: String(kpis.cities),
            label: citiesNoun(kpis.cities, locale, td),
          },
          {
            value: String(kpis.totalScreens),
            label: td('screens'),
          },
          {
            value: kpis.formatBudget,
            unit: 'UZS',
            label: td('budgetWithFees'),
          },
        ]}
        creatives={creatives}
        creativesTitle={tCreatives('title')}
        creativesSubtitle={tCreatives('subtitle')}
      />

      {/* Filter row — sits under the hero and contains period, type, city dropdowns */}
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] font-medium text-[var(--text-3)]">
          {td('filterLabel')}
        </span>
        <FilterBar
          cities={allCities}
          availableTypes={availableTypes}
          periods={periodsWithData}
          selectedPeriods={selectedPeriods}
          locale={locale}
        />
      </div>
      {(() => {
        const periodNames = selectedPeriods
          .map(id => periodsWithData.find(p => p.id === id)?.name)
          .filter((n): n is string => !!n);
        const parts: string[] = [];
        if (periodNames.length > 0) parts.push(periodNames.join(', '));
        if (filters.types.length > 0) parts.push(filters.types.join(', '));
        if (filters.cities.length > 0) parts.push(filters.cities.join(', '));
        const hasAny = parts.length > 0;
        return (
          <p className="mb-4 text-xs text-[var(--text-3)]">
            {td('showingLabel')}{' '}
            <span className="text-[var(--text-2)]">{hasAny ? parts.join(' · ') : td('showAllSummary')}</span>
            {hasAny && <> — {kpis.totalScreens} {td('screensSuffix')}</>}
          </p>
        );
      })()}

      {/* Reach (Охват) — full-width, own row, sits above the metrics strip */}
      <div className="mb-2">
        <ReachCard campaignId={selectedCampaignId} rows={reachEntries} audience={reachAudience} />
      </div>

      {/* Efficiency strip — accented metrics row (avg OTS, CPT факт, avg impressions/day) */}
      <div className="mb-2">
        <EfficiencyStrip
          totalBudgetWithoutVat={kpis.totalBudgetWithoutVat}
          totalOtsPlan={kpis.totalOtsPlan}
          totalRatingFact={kpis.totalRatingFact}
          avgImpressionsPerDay={kpis.avgImpressionsPerDay}
          totalScreens={kpis.totalScreens}
        />
      </div>

      {/* TODO: disabled per product decision 2026-04-20; restore if re-enabled
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlanFactBar plan={kpis.totalOtsPlan} fact={kpis.totalOtsFact} />
        {donutTotal > 0 && <ImpressionsDonut data={donutData} total={donutTotal} isFact={donutIsFact} />}
      </div>
      */}

      {/* Row: Plan vs Fact by Type + Budget by Type donut. Grid switches to a
          single column when only one of the two has data so the visible card
          fills the row instead of leaving an empty half. */}
      {(planVsFactByType.length > 0 || budgetByType.length > 0) && (
        <div
          className={`mb-2 grid gap-2 ${
            planVsFactByType.length > 0 && budgetByType.length > 0
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1'
          }`}
        >
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
        <div className="mb-2 space-y-3">
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

      {/* Map — only when a Yandex URL has been configured for the campaign */}
      {hasYandexMap && (
        <div className="mb-2">
          <ScreenMap screens={mapScreens} />
        </div>
      )}

      {/* Heatmap (Foursquare Studio) */}
      {heatmapEmbedUrl && (
        <div className="mb-2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
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
      {/* "Top screens" bar — only meaningful when there's more than one
          screen to compare. A single bar isn't useful. */}
      {topScreens.length > 1 && (
        <div className="mb-2">
          <TopScreensBar data={topScreens} />
        </div>
      )}

      {/* Screens Table */}
      <div className="mb-2">
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
