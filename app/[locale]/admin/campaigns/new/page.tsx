import { prisma } from '@/lib/db';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CampaignForm } from '@/components/admin/campaign-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getVatRateAt } from '@/lib/vat';

export default async function NewCampaignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const [clients, currencies, vatRate] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.currencyRef.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, nameRu: true, nameEn: true, nameUz: true },
    }),
    // For new campaigns we don't yet know periodStart, so the form preview
    // uses today's rate. The server resolves the actual VAT from the
    // user-entered periodStart on save, so the stored totalFinal is exact
    // even if the preview is briefly off.
    getVatRateAt(new Date()),
  ]);
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
      <CampaignForm locale={locale} clients={clients} currencies={currencies} vatRate={vatRate ?? 0} />
    </div>
  );
}
