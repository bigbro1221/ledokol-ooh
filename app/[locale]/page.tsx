import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  if (session.user.role === 'ADMIN') {
    redirect(`/${locale}/admin`);
  }

  redirect(`/${locale}/dashboard`);
}
