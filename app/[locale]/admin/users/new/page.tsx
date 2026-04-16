import { prisma } from '@/lib/db';
import { UserForm } from '@/components/admin/user-form';

export default async function NewUserPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const clients = await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Новый пользователь</h1>
      <UserForm locale={locale} clients={clients} />
    </div>
  );
}
