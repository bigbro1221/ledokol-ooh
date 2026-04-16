import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { UploadDropzone } from '@/components/admin/upload-dropzone';

export default async function UploadPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  });

  if (!campaign) notFound();

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-[var(--text-3)]">{campaign.client.name}</p>
        <h1 className="text-xl font-semibold">Загрузка медиаплана: {campaign.name}</h1>
      </div>
      <UploadDropzone campaignId={id} locale={locale} />
    </div>
  );
}
