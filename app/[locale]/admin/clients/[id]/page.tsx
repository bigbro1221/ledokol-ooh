import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { ClientForm } from '@/components/admin/client-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function EditClientPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const client = await prisma.client.findUnique({
    where: { id },
    include: { campaigns: { orderBy: { createdAt: 'desc' } } },
  });

  if (!client) notFound();
  const t = await getTranslations({ locale, namespace: 'admin' });
  const tStatus = await getTranslations({ locale, namespace: 'campaignStatus' });

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/${locale}/admin/clients`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {t('clients')}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{t('editClient', { name: client.name })}</h1>
      </div>
      <ClientForm
        locale={locale}
        initial={{ id: client.id, name: client.name, contactPerson: client.contactPerson }}
      />

      {client.campaigns.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">{t('clientCampaigns')}</h2>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="bg-[var(--surface-2)]">
                  <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableClientName')}</th>
                  <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableStatus')}</th>
                  <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tablePeriod')}</th>
                </tr>
              </thead>
              <tbody>
                {client.campaigns.map(c => (
                  <tr key={c.id} className="transition-colors hover:bg-[var(--surface-2)]">
                    <td className="border-b border-[var(--border)] px-4 py-3">
                      <Link href={`/${locale}/admin/campaigns/${c.id}`} className="text-sm font-medium hover:text-[var(--brand-primary)]">
                        {c.name}
                      </Link>
                    </td>
                    <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">{tStatus(c.status)}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                      {c.periodStart.toLocaleDateString('ru-RU')} — {c.periodEnd.toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
