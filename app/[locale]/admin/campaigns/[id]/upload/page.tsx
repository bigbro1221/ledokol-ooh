import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { UploadDropzone } from '@/components/admin/upload-dropzone';
import { Download } from 'lucide-react';

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ periodId?: string }>;
}) {
  const { locale, id } = await params;
  const { periodId } = await searchParams;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  });

  if (!campaign) notFound();

  // If periodId provided, fetch period name for the heading
  let periodName: string | null = null;
  if (periodId) {
    const period = await prisma.campaignPeriod.findFirst({ where: { id: periodId, campaignId: id } });
    if (!period) notFound();
    periodName = period.name;
  }

  // Build a clean filename: медиаплан_{client}_{campaign}_{?period}.xlsx
  const slugify = (s: string) => s.trim().replace(/[^\wа-яёА-ЯЁ0-9\s-]/gi, '').replace(/\s+/g, '_');
  const templateFilename = [
    'медиаплан',
    slugify(campaign.client.name),
    slugify(campaign.name),
    periodName ? slugify(periodName) : null,
  ].filter(Boolean).join('_') + '.xlsx';

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--text-3)]">{campaign.client.name} · {campaign.name}</p>
          <h1 className="text-xl font-semibold">
            Загрузка медиаплана{periodName ? `: ${periodName}` : ''}
          </h1>
        </div>
        <a
          href="/templates/mediaplan-template.xlsx"
          download={templateFilename}
          className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <Download size={13} strokeWidth={1.5} />
          Шаблон XLSX
        </a>
      </div>
      <UploadDropzone campaignId={id} locale={locale} periodId={periodId ?? null} />
    </div>
  );
}
