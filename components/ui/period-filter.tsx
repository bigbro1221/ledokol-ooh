'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Period {
  id: string;
  name: string;
}

const COLLAPSE_THRESHOLD = 6;

export function PeriodFilter({
  periods,
  locale,
  selectedFrom,
  selectedTo,
}: {
  periods: Period[];
  locale: string;
  selectedFrom: string | null;
  selectedTo: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const select = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('periodFrom', id);
    params.set('periodTo', id);
    router.push(`/${locale}/dashboard?${params.toString()}`);
  }, [router, searchParams, locale]);

  if (periods.length < 2) return null;

  const fromIdx = periods.findIndex(p => p.id === selectedFrom);
  const toIdx = periods.findIndex(p => p.id === selectedTo);

  function isInRange(idx: number): boolean {
    if (fromIdx < 0 || toIdx < 0) return false;
    return idx >= Math.min(fromIdx, toIdx) && idx <= Math.max(fromIdx, toIdx);
  }

  const visible = expanded ? periods : periods.slice(0, COLLAPSE_THRESHOLD);
  const hidden = periods.length - COLLAPSE_THRESHOLD;
  const isFiltered = selectedFrom || selectedTo;

  const pillBase = 'rounded-full px-3 py-1 text-[11px] font-medium transition-colors';
  const pillActive = 'bg-[var(--brand-primary)] text-white';
  const pillInRange = 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] border border-[var(--brand-primary)]';
  const pillIdle = 'border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]';

  function clearRange() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('periodFrom');
    params.delete('periodTo');
    router.push(`/${locale}/dashboard?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        onClick={clearRange}
        className={`${pillBase} ${!isFiltered ? pillActive : pillIdle}`}
      >
        Весь период
      </button>
      {visible.map((p, i) => {
        const isFrom = p.id === selectedFrom;
        const isTo = p.id === selectedTo;
        const inRange = isInRange(i);
        const isSingle = selectedFrom === selectedTo && isFrom;
        return (
          <button
            key={p.id}
            onClick={() => select(p.id)}
            className={`${pillBase} ${isSingle || (isFrom && isTo) ? pillActive : inRange ? pillInRange : pillIdle}`}
          >
            {p.name}
          </button>
        );
      })}

      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className={`${pillBase} border border-dashed border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-hi)] hover:text-[var(--text-2)]`}
        >
          Ещё {hidden}
        </button>
      )}
      {expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className={`${pillBase} border border-dashed border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-hi)] hover:text-[var(--text-2)]`}
        >
          Скрыть
        </button>
      )}
    </div>
  );
}
