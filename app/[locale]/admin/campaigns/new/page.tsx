import { prisma } from '@/lib/db';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CampaignForm } from '@/components/admin/campaign-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export default async function NewCampaignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const t = await getTranslations({ locale, namespace: 'admin' });

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/${locale}/admin/campaigns`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {t('campaigns')}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{t('newCampaignTitle')}</h1>
      </div>
      <CampaignForm locale={locale} clients={clients} />
    </div>
  );
}
