import { prisma } from '@/lib/db';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { UserForm } from '@/components/admin/user-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export default async function NewUserPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
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
        <h1 className="mt-2 text-xl font-semibold">Новый пользователь</h1>
      </div>
      <UserForm locale={locale} clients={clients} />
    </div>
  );
}
