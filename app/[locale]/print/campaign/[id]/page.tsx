import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCampaignForDashboard, totalsForCampaign } from '@/lib/campaign-detail';
import type { Prisma } from '@prisma/client';
import { PrintCover } from '@/components/print/PrintCover';
import { PrintReadyFlag } from '@/components/print/PrintReadyFlag';
import { PrintSection } from '@/components/print/PrintSection';
import { PrintKpiStrip, fmtBig } from '@/components/print/PrintKpiStrip';
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
      </div>

      <PrintReadyFlag />
    </div>
  );
}
