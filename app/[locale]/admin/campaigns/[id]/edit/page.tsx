import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { CampaignForm } from '@/components/admin/campaign-form';

export default async function EditCampaignPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;

  const [campaign, clients] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        clientId: true,
        periodStart: true,
        periodEnd: true,
        splitByPeriods: true,
        heatmapUrl: true,
        yandexMapUrl: true,
      },
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  if (!campaign) notFound();

  // Format dates as YYYY-MM-DD for date inputs
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-[var(--text-3)]">Редактирование</p>
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
      </div>
      <CampaignForm
        locale={locale}
        clients={clients}
        initial={{
          id: campaign.id,
          name: campaign.name,
          clientId: campaign.clientId,
          periodStart: fmt(campaign.periodStart),
          periodEnd: fmt(campaign.periodEnd),
          splitByPeriods: campaign.splitByPeriods,
          heatmapUrl: campaign.heatmapUrl,
          yandexMapUrl: campaign.yandexMapUrl,
        }}
      />
    </div>
  );
}
