'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserFormProps {
  locale: string;
  clients: { id: string; name: string }[];
  initial?: {
    id: string;
    email: string;
    role: string;
    enabled: boolean;
    clientId: string | null;
    language: string;
  };
}

export function UserForm({ locale, clients, initial }: UserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState(initial?.role || 'CLIENT');
  const isEdit = !!initial;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      email: fd.get('email') as string,
      role: fd.get('role') as string,
      clientId: (fd.get('clientId') as string) || null,
      language: fd.get('language') as string,
    };

    const password = fd.get('password') as string;
    if (password) data.password = password;

    if (isEdit) {
      data.enabled = fd.get('enabled') === 'on';
    }

    const url = isEdit ? `/api/users/${initial.id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    if (!isEdit && !password) {
      setError('Пароль обязателен');
      setLoading(false);
      return;
    }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.errors?.fieldErrors?.email?.[0] || err.errors?.fieldErrors?.password?.[0] || 'Ошибка сохранения');
      return;
    }

    router.push(`/${locale}/admin/users`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Email</label>
        <input
          name="email"
          type="email"
          required
          defaultValue={initial?.email}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {isEdit ? 'Новый пароль (оставьте пустым чтобы не менять)' : 'Пароль'}
        </label>
        <input
          name="password"
          type="password"
          minLength={6}
          required={!isEdit}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Роль</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
        >
          <option value="ADMIN">Администратор</option>
          <option value="CLIENT">Клиент</option>
        </select>
      </div>

      {role === 'CLIENT' && (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Компания</label>
          <select
            name="clientId"
            defaultValue={initial?.clientId || ''}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
          >
            <option value="">Не привязан</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Язык</label>
        <select
          name="language"
          defaultValue={initial?.language || 'RU'}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
        >
          <option value="RU">Русский</option>
          <option value="EN">English</option>
          <option value="UZ">O&apos;zbek</option>
          <option value="TR">Türkçe</option>
        </select>
      </div>

      {isEdit && (
        <div className="flex items-center gap-3">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={initial?.enabled}
            id="enabled"
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          <label htmlFor="enabled" className="text-sm">Аккаунт активен</label>
        </div>
      )}

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
