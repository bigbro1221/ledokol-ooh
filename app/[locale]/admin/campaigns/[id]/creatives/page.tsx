import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { auth, isGoogleLinked } from '@/lib/auth';
import { getFileUrl } from '@/lib/minio';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreativesManager } from '@/components/admin/creatives-manager';

export default async function CreativesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }

  const t = await getTranslations({ locale, namespace: 'creatives' });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
  if (!campaign) notFound();

  const rows = await prisma.creative.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: 'asc' },
  });

  const creatives = await Promise.all(rows.map(async c => ({
    id: c.id,
    name: c.name,
    mimeType: c.mimeType,
    width: c.width,
    height: c.height,
    sizeBytes: Number(c.sizeBytes),
    durationSec: c.durationSec,
    url: await getFileUrl(c.fileKey),
    thumbnailUrl: c.thumbnailKey ? await getFileUrl(c.thumbnailKey) : null,
  })));

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/${locale}/admin/campaigns/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {campaign.name}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-[var(--text-3)]">{t('subtitle')}</p>
      </div>

      <CreativesManager campaignId={id} creatives={creatives} />
    </div>
  );
}
