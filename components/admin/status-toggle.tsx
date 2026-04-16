'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'] as const;
const LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активна',
  PAUSED: 'Пауза',
  COMPLETED: 'Завершена',
};
const STYLES: Record<string, string> = {
  ACTIVE: 'bg-[rgba(16,185,129,0.12)] text-[var(--success)] border-[var(--success)]',
  PAUSED: 'bg-[rgba(234,179,8,0.12)] text-[var(--warning)] border-[var(--warning)]',
  COMPLETED: 'bg-[var(--surface-3)] text-[var(--text-3)] border-[var(--border)]',
  DRAFT: 'bg-[var(--surface-3)] text-[var(--text-3)] border-[var(--border)]',
};

export function StatusToggle({ campaignId, currentStatus }: { campaignId: string; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(status: string) {
    setLoading(true);
    await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1.5">
      {STATUSES.map(s => (
        <button
          key={s}
          disabled={loading || s === currentStatus}
          onClick={() => setStatus(s)}
          className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.04em] transition-all disabled:opacity-100 ${
            s === currentStatus ? STYLES[s] : 'border-[var(--border)] text-[var(--text-4)] hover:border-[var(--border-hi)] hover:text-[var(--text-2)]'
          }`}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
