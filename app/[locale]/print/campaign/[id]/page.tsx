import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCampaignForDashboard } from '@/lib/campaign-detail';
import type { Prisma } from '@prisma/client';
import { PrintCover } from '@/components/print/PrintCover';
import { PrintReadyFlag } from '@/components/print/PrintReadyFlag';
import { PrintSection } from '@/components/print/PrintSection';
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

  const tPdf = await getTranslations({ locale, namespace: 'pdf' });
  const tStatus = await getTranslations({ locale, namespace: 'campaignStatus' });

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
          <p>Summary placeholder — KPI strip goes here (Task 13).</p>
        </PrintSection>
      </div>

      <PrintReadyFlag />
    </div>
  );
}
