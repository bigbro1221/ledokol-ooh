import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CampaignForm } from '@/components/admin/campaign-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { getVatRateAt } from '@/lib/vat';

export default async function EditCampaignPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const t = await getTranslations({ locale, namespace: 'admin' });

  const [campaign, clients, currencies] = await Promise.all([
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
        reportsUrl: true,
        acRate: true,
        mediaType: true,
        additionalCurrencyId: true,
        additionalAmount: true,
        totalBudgetUzs: true,
        productionCost: true,
        totalFinal: true,
        groupId: true,
        _count: { select: { periods: true } },
      },
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.currencyRef.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, nameRu: true, nameEn: true, nameUz: true },
    }),
  ]);

  if (!campaign) notFound();

  // VAT rate active at this campaign's periodStart — used by the form's
  // read-only totalFinal preview. Server is authoritative on save.
  const vatRate = (await getVatRateAt(campaign.periodStart)) ?? 0;

  // Format dates as YYYY-MM-DD for date inputs
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const hasFinancials =
    campaign.totalBudgetUzs != null ||
    campaign.productionCost != null ||
    campaign.totalFinal != null ||
    campaign.additionalAmount != null;
  const canChangeMediaType = campaign._count.periods === 0 && !hasFinancials;

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
        <p className="mt-2 text-xs text-[var(--text-3)]">{t('editCampaign')}</p>
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
      </div>
      <CampaignForm
        locale={locale}
        clients={clients}
        currencies={currencies}
        vatRate={vatRate}
        initial={{
          id: campaign.id,
          name: campaign.name,
          clientId: campaign.clientId,
          periodStart: fmt(campaign.periodStart),
          periodEnd: fmt(campaign.periodEnd),
          splitByPeriods: campaign.splitByPeriods,
          heatmapUrl: campaign.heatmapUrl,
          yandexMapUrl: campaign.yandexMapUrl,
          reportsUrl: campaign.reportsUrl,
          acRate: campaign.acRate ? String(Number(campaign.acRate) * 100) : '',
          mediaType: campaign.mediaType,
          additionalCurrencyId: campaign.additionalCurrencyId,
          additionalAmount: campaign.additionalAmount != null ? Number(campaign.additionalAmount) : null,
          totalBudgetUzs: campaign.totalBudgetUzs != null ? Number(campaign.totalBudgetUzs) : null,
          productionCost: campaign.productionCost != null ? Number(campaign.productionCost) : null,
          totalFinal: campaign.totalFinal != null ? Number(campaign.totalFinal) : null,
          canChangeMediaType,
          groupId: campaign.groupId,
        }}
      />
    </div>
  );
}
