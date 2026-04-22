import { prisma } from '@/lib/db';
import { UserForm } from '@/components/admin/user-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function NewUserPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }
  const clients = await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Новый пользователь</h1>
      <UserForm locale={locale} clients={clients} />
    </div>
  );
}
