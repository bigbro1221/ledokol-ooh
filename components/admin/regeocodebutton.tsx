'use client';

import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export function RegeocodeButton({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ matched: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState('loading');
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/geocode`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Ошибка геокодирования');
        setState('error');
      } else {
        setResult(data);
        setState('done');
      }
    } catch {
      setError('Сетевая ошибка');
      setState('error');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
      >
        {state === 'loading'
          ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
          : <MapPin size={13} strokeWidth={1.5} />
        }
        Обновить геопривязку
      </button>
      {state === 'done' && result && (
        <span className="text-xs text-[var(--success)]">
          {result.matched} / {result.total} адресов привязано
        </span>
      )}
      {state === 'error' && error && (
        <span className="text-xs text-[var(--error,#ef4444)]">{error}</span>
      )}
    </div>
  );
}
