import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth, isGoogleLinked } from '@/lib/auth';
import { UploadDropzone } from '@/components/admin/upload-dropzone';
import { Download, ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ periodId?: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const t = await getTranslations({ locale, namespace: 'admin' });
  const { periodId } = await searchParams;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  });

  if (!campaign) notFound();

  // For OTHER_CARRIERS campaigns, periods come from the file — ignore any
  // periodId from the URL so the heading and parser dispatch stay correct.
  const effectivePeriodId = campaign.mediaType === 'OTHER_CARRIERS' ? null : (periodId ?? null);

  // If periodId provided, fetch period name for the heading
  let periodName: string | null = null;
  if (effectivePeriodId) {
    const period = await prisma.campaignPeriod.findFirst({ where: { id: effectivePeriodId, campaignId: id } });
    if (!period) notFound();
    periodName = period.name;
  }

  const templateHref = campaign.mediaType === 'OTHER_CARRIERS'
    ? '/templates/other-carriers-template.xlsx'
    : '/templates/mediaplan-template.xlsx';

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
          <Link
            href={`/${locale}/admin/campaigns/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            {campaign.name}
          </Link>
          <p className="mt-2 text-xs text-[var(--text-3)]">{campaign.client.name} · {campaign.name}</p>
          <h1 className="text-xl font-semibold">
            {periodName ? t('uploadTitleWithPeriod', { name: periodName }) : t('uploadTitle')}
          </h1>
        </div>
        <a
          href={templateHref}
          download={templateFilename}
          className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <Download size={13} strokeWidth={1.5} />
          {t('templateXlsx')}
        </a>
      </div>
      <UploadDropzone campaignId={id} locale={locale} periodId={effectivePeriodId} mediaType={campaign.mediaType} />
    </div>
  );
}
