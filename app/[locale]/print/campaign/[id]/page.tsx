import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import {
  getCampaignForDashboard,
  totalsForCampaign,
  buildMonthlyRows,
  buildPlanFactByType,
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
  const tPdf = await getTranslations({ locale, namespace: 'pdf' });
  const tStatus = await getTranslations({ locale, namespace: 'campaignStatus' });
  const tDash = await getTranslations({ locale, namespace: 'dashboard' });
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
        generatedOnLabel={tPdf('generatedOn')}
        generatedAt={new Date()}
        locale={locale}
      />

      <div className="pdf-page">
        <PrintSection title={tPdf('section.summary')}>
          <PrintKpiStrip cells={[
            { label: tDash('kpiTotalBudget'),  value: fmtBig(totals.totalBudget),  unit: 'UZS' },
            { label: tDash('kpiTotalScreens'), value: totals.totalScreens.toLocaleString('ru-RU'), unit: tDash('kpiScreensUnit') },
            { label: tDash('kpiTotalOts'),     value: fmtBig(totals.otsPlan),      unit: tDash('kpiOtsUnit') },
            { label: 'OTS Fact',               value: fmtBig(totals.otsFact),      unit: tDash('kpiOtsUnit') },
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

        {planFactByType.length > 0 && (
          <PrintSection title={tPdf('section.breakdown')}>
            <PrintPlanFactBars
              rows={planFactByType}
              planLabel={tDash('reachPlanLabel')}
              factLabel={tDash('reachFactLabel')}
            />
          </PrintSection>
        )}
      </div>

      <PrintReadyFlag />
    </div>
  );
}
