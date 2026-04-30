import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { UserForm } from '@/components/admin/user-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';

export default async function EditUserPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, status: true, enabled: true, clientId: true, language: true },
  });

  if (!user) notFound();

  const clients = await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const t = await getTranslations({ locale, namespace: 'admin' });

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/${locale}/admin/users`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {t('users')}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{t('editUser', { email: user.email })}</h1>
      </div>
      <UserForm locale={locale} clients={clients} initial={user} />
    </div>
  );
}
