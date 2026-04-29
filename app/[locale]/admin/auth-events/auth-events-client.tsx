'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface AuthEvent {
  id: string;
  createdAt: string;
  type: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  provider: string | null;
  userEmail: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
}

interface Props {
  locale: string;
  types: string[];
  currentType: string;
  currentLevel: string;
  currentEmail: string;
  events: AuthEvent[];
}

const LEVEL_STYLE: Record<AuthEvent['level'], string> = {
  INFO: 'bg-[var(--surface-3)] text-[var(--text-2)]',
  WARN: 'bg-[rgba(217,119,6,0.12)] text-[var(--warning)]',
  ERROR: 'bg-[rgba(220,38,38,0.12)] text-[var(--danger)]',
};

export function AuthEventsClient({ locale, types, currentType, currentLevel, currentEmail, events }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailDraft, setEmailDraft] = useState(currentEmail);
  const [openId, setOpenId] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/${locale}/admin/auth-events?${params.toString()}`);
  }

  function clearAll() {
    setEmailDraft('');
    router.push(`/${locale}/admin/auth-events`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={currentType}
          onChange={(e) => setParam('type', e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
        >
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={currentLevel}
          onChange={(e) => setParam('level', e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
        >
          <option value="">All levels</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>

        <form
          onSubmit={(e) => { e.preventDefault(); setParam('email', emailDraft.trim()); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="email contains…"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs w-[200px]"
          />
          <button type="submit" className="rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs text-white">
            Filter
          </button>
        </form>

        {(currentType || currentLevel || currentEmail) && (
          <button onClick={clearAll} className="text-xs text-[var(--text-3)] hover:text-[var(--danger)]">
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">When</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">Type</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">Lvl</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">Provider</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">User</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">Message</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-3)]">No events</td></tr>
            )}
            {events.map(e => (
              <Row key={e.id} event={e} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ event, open, onToggle }: { event: AuthEvent; open: boolean; onToggle: () => void }) {
  const ts = new Date(event.createdAt);
  const timeStr = ts.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
      >
        <td className="px-4 py-2 text-xs text-[var(--text-3)] whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>{timeStr}</td>
        <td className="px-4 py-2 text-xs">{event.type}</td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${LEVEL_STYLE[event.level]}`}>{event.level}</span>
        </td>
        <td className="px-4 py-2 text-xs text-[var(--text-3)]">{event.provider ?? '—'}</td>
        <td className="px-4 py-2 text-xs">{event.userEmail ?? '—'}</td>
        <td className="px-4 py-2 text-xs">{event.message}</td>
      </tr>
      {open && event.metadata && (
        <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <td colSpan={6} className="px-4 py-3">
            <pre className="text-[11px] text-[var(--text-2)] whitespace-pre-wrap" style={{ fontFamily: 'var(--font-mono)' }}>
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
