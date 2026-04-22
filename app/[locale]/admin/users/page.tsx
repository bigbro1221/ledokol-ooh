import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const t = await getTranslations({ locale, namespace: 'admin' });
  const tRoles = await getTranslations({ locale, namespace: 'roles' });
  const roleLabel = (role: string) => role === 'ADMIN' ? tRoles('adminShort') : tRoles('CLIENT');
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, role: true, enabled: true,
      client: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('users')}</h1>
        <Link
          href={`/${locale}/admin/users/new`}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
        >
          <Plus size={16} strokeWidth={1.5} /> {t('newUser')}
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Email</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableRole')}</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableCompany')}</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableStatus')}</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableCreated')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="transition-colors hover:bg-[var(--surface-2)]">
                <td className="border-b border-[var(--border)] px-4 py-3">
                  <Link href={`/${locale}/admin/users/${u.id}`} className="text-sm font-medium hover:text-[var(--brand-primary)]">
                    {u.email}
                  </Link>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ${
                    u.role === 'ADMIN'
                      ? 'bg-[rgba(59,130,246,0.12)] text-[var(--info)]'
                      : 'bg-[var(--surface-3)] text-[var(--text-2)]'
                  }`}>
                    {roleLabel(u.role)}
                  </span>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">
                  {u.client?.name || '—'}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ${
                    u.enabled
                      ? 'bg-[rgba(16,185,129,0.12)] text-[var(--success)]'
                      : 'bg-[rgba(239,68,68,0.12)] text-[var(--danger)]'
                  }`}>
                    {u.enabled ? t('statusEnabled') : t('statusDisabled')}
                  </span>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {u.createdAt.toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
