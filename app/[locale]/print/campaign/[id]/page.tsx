import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import {
  getCampaignForDashboard,
  totalsForCampaign,
  buildPlanFactByType,
  buildTopScreens,
  buildBudgetByType,
  buildCityPlanFact,
  citiesCount,
  budgetWithFees,
  avgOtsPerSurface,
  avgImpressionsPerDay,
  cptFact,
  loadCreatives,
} from '@/lib/campaign-detail';
import type { Prisma } from '@prisma/client';
import { PrintCover } from '@/components/print/PrintCover';
import { PrintReadyFlag } from '@/components/print/PrintReadyFlag';
import { PrintSection } from '@/components/print/PrintSection';
import { PrintKpiStrip, fmtBig } from '@/components/print/PrintKpiStrip';
import { PrintReach } from '@/components/print/PrintReach';
import { PrintPlanFactBars } from '@/components/print/PrintPlanFactBars';
import { PrintBudgetByType } from '@/components/print/PrintBudgetByType';
import { PrintCityPlanFactTable } from '@/components/print/PrintCityPlanFactTable';
import { PrintTopScreensList } from '@/components/print/PrintTopScreensList';
import { PrintCreatives } from '@/components/print/PrintCreatives';
import { PrintScreensTable } from '@/components/print/PrintScreensTable';
import '../../print.css';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ locale: string; id: string }>;
}

export default async function PrintCampaignPage({ params }: Params) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const clientFilter: Prisma.CampaignWhereInput =
    session.user.role === 'CLIENT' && session.user.clientId
      ? { client: { users: { some: { id: session.user.id } } } }
      : {};

  const campaign = await getCampaignForDashboard(id, { clientFilter });
  if (!campaign) notFound();

  const totals = totalsForCampaign(campaign);
  const creatives = await loadCreatives(campaign.id);
  const tPdf = await getTranslations({ locale, namespace: 'pdf' });
  const tStatus = await getTranslations({ locale, namespace: 'campaignStatus' });
  const tDash = await getTranslations({ locale, namespace: 'dashboard' });
  const tCp = await getTranslations({ locale, namespace: 'campaignsPage' });
  const tUa = await getTranslations({ locale, namespace: 'uploadAdmin' });
  const tTypes = await getTranslations({ locale, namespace: 'screenTypes' });
  const tFilters = await getTranslations({ locale, namespace: 'filters' });
  const typeLabels: Record<string, string> = {
    LED: tTypes('LEDscreens'),
    STATIC: tTypes('STATIC'),
    STOP: tTypes('STOPLed'),
    AIRPORT: tTypes('AIRPORT'),
    BUS: tTypes('BUS'),
    ROOF: tTypes('ROOF'),
    BRANDMAUER: tTypes('BRANDMAUER'),
    CINEMA: tTypes('CINEMA'),
    METRO: tTypes('METRO'),
  };

  const planFactByType = buildPlanFactByType(campaign, typeLabels);
  const budgetByType = buildBudgetByType(campaign, typeLabels);
  const cityPlanFact = buildCityPlanFact(campaign);
  const topScreens = buildTopScreens(campaign, 10);

  const cities = citiesCount(campaign);
  const budget = budgetWithFees(campaign);
  const avgOts = avgOtsPerSurface(campaign);
  const cpt = cptFact(campaign);
  const avgImpDay = avgImpressionsPerDay(campaign);

  const reachEntries = campaign.reachEntries
    .filter(e => e.pinned)
    .map(e => ({ n: e.n, plan: e.plan, fact: e.fact }));

  return (
    <div className="pdf-root">
      <PrintCover
        clientName={campaign.client.name}
        campaignName={campaign.name}
        periodStart={campaign.periodStart}
        periodEnd={campaign.periodEnd}
        status={campaign.status}
        statusLabel={tStatus(campaign.status)}
        clientLabel={tPdf('coverClient')}
        generatedOnText={tPdf('generatedOn', {
          date: new Date().toLocaleDateString(
            locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU',
            { day: '2-digit', month: '2-digit', year: 'numeric' },
          ),
        })}
        locale={locale}
      />

      <div className="pdf-page">
        <PrintSection title={tPdf('section.summary')}>
          {/* Row 1 — three "what's the campaign" KPIs */}
          <PrintKpiStrip
            cells={[
              { label: tPdf('kpiCities'), value: cities.toLocaleString('ru-RU') },
              {
                label: tPdf('kpiSurfaces'),
                value: totals.totalScreens.toLocaleString('ru-RU'),
                unit: tCp('kpiScreensUnit'),
              },
              { label: tPdf('kpiBudgetWithFees'), value: fmtBig(budget), unit: 'UZS' },
            ]}
          />

          {/* Row 2 — reach. Only rendered when the campaign has pinned entries. */}
          {reachEntries.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <PrintReach
                entries={reachEntries}
                title={tDash('reachCardTitle')}
                planLabel={tDash('reachPlanLabel')}
                factLabel={tDash('reachFactLabel')}
              />
            </div>
          )}

          {/* Row 3 — three efficiency KPIs */}
          <div style={{ marginTop: 10 }}>
            <PrintKpiStrip
              cells={[
                {
                  label: tPdf('kpiAvgOts'),
                  value: fmtBig(avgOts),
                  unit: tCp('kpiOtsUnit'),
                },
                {
                  label: tPdf('kpiCpt'),
                  value: cpt !== null ? cpt.toLocaleString('ru-RU') : '—',
                  unit: cpt !== null ? 'UZS' : undefined,
                },
                {
                  label: tPdf('kpiAvgImpDay'),
                  value: avgImpDay !== null ? avgImpDay.toLocaleString('ru-RU') : '—',
                },
              ]}
            />
          </div>
        </PrintSection>

        {planFactByType.length > 0 && (
          <PrintSection title={tPdf('section.breakdown')}>
            <PrintPlanFactBars
              rows={planFactByType}
              planLabel={tDash('reachPlanLabel')}
              factLabel={tDash('reachFactLabel')}
            />
          </PrintSection>
        )}

        {budgetByType.length > 0 && (
          <PrintSection title={tPdf('section.budgetByType')}>
            <PrintBudgetByType rows={budgetByType} />
          </PrintSection>
        )}

        {cityPlanFact.length > 0 && (
          <PrintSection title={tPdf('section.cityPlanFact')}>
            <PrintCityPlanFactTable
              rows={cityPlanFact}
              cityLabel={tFilters('cityLabel')}
              planLabel={tDash('reachPlanLabel')}
              factLabel={tDash('reachFactLabel')}
            />
          </PrintSection>
        )}

        {topScreens.length > 0 && (
          <PrintSection title={tPdf('section.topScreensImpressions')}>
            <PrintTopScreensList rows={topScreens} />
          </PrintSection>
        )}

        <PrintSection title={tPdf('section.creatives')}>
          <PrintCreatives creatives={creatives} openLabel={tPdf('creativePlay')} />
        </PrintSection>

        <PrintSection title={tPdf('section.screens')}>
          <PrintScreensTable
            campaign={campaign}
            labels={{
              rowNum: '#',
              type: tUa('colType'),
              city: tUa('colCity'),
              address: tUa('colAddress'),
              otsPlan: tDash('reachPlanLabel'),
              otsFact: tDash('reachFactLabel'),
              size: tUa('colSize'),
              impPerDay: tUa('colImpressions'),
            }}
          />
        </PrintSection>
      </div>

      <PrintReadyFlag />
    </div>
  );
}
