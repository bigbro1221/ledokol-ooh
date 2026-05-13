import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import {
  getCampaignForDashboard,
  totalsForCampaign,
  buildMonthlyRows,
  buildPlanFactByType,
  buildCityRows,
  buildTypeSlices,
  buildTopScreens,
  loadCreatives,
} from '@/lib/campaign-detail';
import type { Prisma } from '@prisma/client';
import { PrintCover } from '@/components/print/PrintCover';
import { PrintReadyFlag } from '@/components/print/PrintReadyFlag';
import { PrintSection } from '@/components/print/PrintSection';
import { PrintKpiStrip, fmtBig } from '@/components/print/PrintKpiStrip';
import { PrintEfficiency } from '@/components/print/PrintEfficiency';
import { PrintReach } from '@/components/print/PrintReach';
import { PrintMonthlyChart } from '@/components/print/PrintMonthlyChart';
import { PrintPlanFactBars } from '@/components/print/PrintPlanFactBars';
import { PrintCityBars } from '@/components/print/PrintCityBars';
import { PrintTypeDonut } from '@/components/print/PrintTypeDonut';
import { PrintTopScreens } from '@/components/print/PrintTopScreens';
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
  const typeLabels: Record<string, string> = {
    LED: tTypes('LEDscreens'),
    STATIC: tTypes('STATIC'),
    STOP: tTypes('STOPLed'),
    AIRPORT: tTypes('AIRPORT'),
    BUS: tTypes('BUS'),
  };

  const monthly = buildMonthlyRows(campaign);
  const planFactByType = buildPlanFactByType(campaign, typeLabels);
  const cityRows = buildCityRows(campaign);
  const typeSlices = buildTypeSlices(campaign, typeLabels);
  const topScreens = buildTopScreens(campaign, 10);
  const hasBreakdown = planFactByType.length > 0 || cityRows.length > 0 || typeSlices.length > 0;

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
        generatedOnText={tPdf('generatedOn', { date: new Date().toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) })}
        locale={locale}
      />

      <div className="pdf-page">
        <PrintSection title={tPdf('section.summary')}>
          <PrintKpiStrip cells={[
            { label: tCp('kpiTotalBudget'),  value: fmtBig(totals.totalBudget),  unit: 'UZS' },
            { label: tCp('kpiTotalScreens'), value: totals.totalScreens.toLocaleString('ru-RU'), unit: tCp('kpiScreensUnit') },
            { label: tCp('kpiTotalOts'),     value: fmtBig(totals.otsPlan),      unit: tCp('kpiOtsUnit') },
            { label: tPdf('otsFact'),        value: fmtBig(totals.otsFact),      unit: tCp('kpiOtsUnit') },
          ]} />
        </PrintSection>

        <PrintSection title={tPdf('section.efficiency')}>
          <PrintEfficiency
            otsPlan={totals.otsPlan}
            otsFact={totals.otsFact}
            label={{
              plan: tDash('reachPlanLabel'),
              fact: tDash('reachFactLabel'),
              completion: tDash('reachCompletionMeta'),
            }}
          />
          <div style={{ height: 10 }} />
          <PrintReach
            entries={campaign.reachEntries.filter(e => e.pinned).map(e => ({ n: e.n, plan: e.plan, fact: e.fact }))}
            planLabel={tDash('reachPlanLabel')}
            factLabel={tDash('reachFactLabel')}
          />
        </PrintSection>

        {monthly.length > 0 && (
          <PrintSection title={tPdf('section.monthly')}>
            <PrintMonthlyChart
              rows={monthly}
              planLabel={tDash('reachPlanLabel')}
              factLabel={tDash('reachFactLabel')}
            />
          </PrintSection>
        )}

        {hasBreakdown && (
          <PrintSection title={tPdf('section.breakdown')}>
            {planFactByType.length > 0 && (
              <PrintPlanFactBars
                rows={planFactByType}
                planLabel={tDash('reachPlanLabel')}
                factLabel={tDash('reachFactLabel')}
              />
            )}
            {(cityRows.length > 0 || typeSlices.length > 0) && (
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                {cityRows.length > 0 && (
                  <PrintCityBars rows={cityRows} label={tDash('reachPlanLabel')} />
                )}
                {typeSlices.length > 0 && <PrintTypeDonut slices={typeSlices} />}
              </div>
            )}
          </PrintSection>
        )}

        {topScreens.length > 0 && (
          <PrintSection title={tPdf('section.topScreens')}>
            <PrintTopScreens rows={topScreens} label={tDash('reachPlanLabel')} />
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
