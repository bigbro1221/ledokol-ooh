'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClientFormProps {
  locale: string;
  initial?: { id: string; name: string; contactPerson: string | null };
}

export function ClientForm({ locale, initial }: ClientFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!initial;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const data = { name: fd.get('name') as string, contactPerson: fd.get('contactPerson') as string };

    const url = isEdit ? `/api/clients/${initial.id}` : '/api/clients';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.errors?.fieldErrors?.name?.[0] || 'Ошибка сохранения');
      return;
    }

    router.push(`/${locale}/admin/clients`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          Название компании
        </label>
        <input
          name="name"
          required
          defaultValue={initial?.name}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          Контактное лицо
        </label>
        <input
          name="contactPerson"
          defaultValue={initial?.contactPerson || ''}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
        />
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {loading ? '...' : isEdit ? 'Сохранить' : 'Создать'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
