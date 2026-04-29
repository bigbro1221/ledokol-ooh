'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { suggestEmailCorrection } from '@/lib/email-suggestions';
import { useTranslations } from 'next-intl';

interface UserFormProps {
  locale: string;
  clients: { id: string; name: string }[];
  initial?: {
    id: string;
    email: string;
    role: string;
    status: string;
    enabled: boolean;
    clientId: string | null;
    language: string;
  };
}

const STATUS_LABELS: Record<string, string> = {
  INVITED: 'Приглашён',
  ACTIVE: 'Активен',
  DISABLED: 'Отключён',
};

const STATUS_COLORS: Record<string, string> = {
  INVITED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DISABLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function UserForm({ locale, clients, initial }: UserFormProps) {
  const router = useRouter();
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const tf = useTranslations('forms');
  const tRoles = useTranslations('roles');
  const tLang = useTranslations('languages');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [role, setRole] = useState(initial?.role || 'CLIENT');
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState(initial?.email ?? '');
  const [resendLoading, setResendLoading] = useState(false);
  const isEdit = !!initial;

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEmailValue(val);
    setEmailSuggestion(suggestEmailCorrection(val));
  }

  function applySuggestion() {
    setEmailValue(emailSuggestion!);
    setEmailSuggestion(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setToast('');

    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      email: emailValue,
      role: fd.get('role') as string,
      clientId: (fd.get('clientId') as string) || null,
      language: fd.get('language') as string,
    };

    if (isEdit) {
      data.enabled = fd.get('enabled') === 'on';
    }

    const url = isEdit ? `/api/users/${initial.id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(
        err.errors?.fieldErrors?.email?.[0] ||
          err.errors?.fieldErrors?.password?.[0] ||
          'Ошибка сохранения',
      );
      return;
    }

    if (!isEdit) {
      const result = await res.json();
      if (result.inviteSent) {
        setToast(`Приглашение отправлено на ${emailValue}`);
      }
      setTimeout(() => {
        router.push(`/${locale}/admin/users`);
        router.refresh();
      }, 1500);
      return;
    }

    router.push(`/${locale}/admin/users`);
    router.refresh();
  }

  async function handleResendActivation() {
    if (!initial?.id) return;
    setResendLoading(true);
    setError('');
    setToast('');
    const res = await fetch(`/api/admin/users/${initial.id}/resend-activation`, { method: 'POST' });
    setResendLoading(false);
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Не удалось отправить повторное приглашение');
      return;
    }
    setToast('Приглашение отправлено повторно');
  }

  async function handleResetToInvited() {
    if (!initial?.id) return;
    if (!confirm('Сбросить пользователя в статус «Приглашён»? Все связанные Google-аккаунты будут отвязаны, и будет отправлено новое приглашение.')) return;
    setResendLoading(true);
    setError('');
    setToast('');
    const res = await fetch(`/api/admin/users/${initial.id}/reset-to-invited`, { method: 'POST' });
    setResendLoading(false);
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Не удалось сбросить статус');
      return;
    }
    setToast('Статус сброшен. Новое приглашение отправлено.');
    router.refresh();
  }

  async function handleDelete() {
    if (!initial?.id) return;
    if (!confirm(`Удалить пользователя ${initial.email} безвозвратно? Все связанные данные (сессии, токены, привязки Google) будут удалены.`)) return;
    setResendLoading(true);
    setError('');
    setToast('');
    const res = await fetch(`/api/users/${initial.id}`, { method: 'DELETE' });
    setResendLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? 'Не удалось удалить пользователя');
      return;
    }
    router.push(`/${locale}/admin/users`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{ta('email')}</label>
        <input
          name="email"
          type="email"
          required
          value={emailValue}
          onChange={handleEmailChange}
          disabled={isEdit}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)] disabled:opacity-60"
        />
        {emailSuggestion && !isEdit && (
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Вы имели в виду{' '}
            <button
              type="button"
              onClick={applySuggestion}
              className="font-medium text-[var(--brand-primary)] hover:underline"
            >
              {emailSuggestion}
            </button>
            ?
          </p>
        )}
      </div>

      {isEdit && initial.status && (
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[initial.status] ?? ''}`}>
            {STATUS_LABELS[initial.status] ?? initial.status}
          </span>
          {initial.status === 'INVITED' && (
            <button
              type="button"
              onClick={handleResendActivation}
              disabled={resendLoading}
              className="text-xs text-[var(--brand-primary)] hover:underline disabled:opacity-50"
            >
              {resendLoading ? 'Отправка...' : 'Повторить приглашение'}
            </button>
          )}
          {initial.status !== 'INVITED' && (
            <button
              type="button"
              onClick={handleResetToInvited}
              disabled={resendLoading}
              className="text-xs text-[var(--text-3)] hover:text-[var(--danger)] hover:underline disabled:opacity-50"
            >
              {resendLoading ? 'Сброс...' : 'Сбросить и переотправить приглашение'}
            </button>
          )}
          {(initial.status === 'DISABLED' || !initial.enabled) && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={resendLoading}
              className="text-xs text-[var(--danger)] hover:underline disabled:opacity-50"
            >
              Удалить пользователя
            </button>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{tf('role')}</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
        >
          <option value="ADMIN">{tRoles('ADMIN')}</option>
          <option value="CLIENT">{tRoles('CLIENT')}</option>
        </select>
      </div>

      {role === 'CLIENT' && (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{tf('company')}</label>
          <select
            name="clientId"
            defaultValue={initial?.clientId || ''}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
          >
            <option value="">{tf('notLinked')}</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{tf('language')}</label>
        <select
          name="language"
          defaultValue={initial?.language || 'RU'}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none"
        >
          <option value="RU">{tLang('RU')}</option>
          <option value="EN">{tLang('EN')}</option>
          <option value="UZ">{tLang('UZ')}</option>
          <option value="TR">{tLang('TR')}</option>
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
          <label htmlFor="enabled" className="text-sm">{tf('accountEnabled')}</label>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {toast && <p className="text-sm text-green-600 dark:text-green-400">{toast}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {loading ? '...' : isEdit ? tc('save') : tc('create')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
