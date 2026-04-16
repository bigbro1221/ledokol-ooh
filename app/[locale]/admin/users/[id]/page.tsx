import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { UserForm } from '@/components/admin/user-form';

export default async function EditUserPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, enabled: true, clientId: true, language: true },
  });

  if (!user) notFound();

  const clients = await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Редактировать: {user.email}</h1>
      <UserForm locale={locale} clients={clients} initial={user} />
    </div>
  );
}
