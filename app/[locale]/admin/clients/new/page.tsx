import { ClientForm } from '@/components/admin/client-form';

export default async function NewClientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Новый клиент</h1>
      <ClientForm locale={locale} />
    </div>
  );
}
