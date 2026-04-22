import { ClientForm } from '@/components/admin/client-form';
import { auth, isGoogleLinked } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function NewClientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session?.user?.id && !(await isGoogleLinked(session.user.id))) {
    redirect(`/${locale}/profile?mustLinkGoogle=1`);
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Новый клиент</h1>
      <ClientForm locale={locale} />
    </div>
  );
}
