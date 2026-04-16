import { prisma } from '@/lib/db';
import { CampaignForm } from '@/components/admin/campaign-form';

export default async function NewCampaignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Новая кампания</h1>
      <CampaignForm locale={locale} clients={clients} />
    </div>
  );
}
