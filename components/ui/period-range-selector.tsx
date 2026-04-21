'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

interface Period {
  id: string;
  name: string;
}

export function PeriodRangeSelector({
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

  function update(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set('periodFrom', from); else params.delete('periodFrom');
    if (to) params.set('periodTo', to); else params.delete('periodTo');
    router.push(`/${locale}/dashboard?${params.toString()}`);
  }

  function handleFrom(e: React.ChangeEvent<HTMLSelectElement>) {
    const newFrom = e.target.value;
    const fromIdx = periods.findIndex(p => p.id === newFrom);
    const toIdx = periods.findIndex(p => p.id === selectedTo);
    // If new from is after current to, snap to to the same month
    const newTo = toIdx >= 0 && toIdx < fromIdx ? newFrom : (selectedTo ?? newFrom);
    update(newFrom, newTo);
  }

  function handleTo(e: React.ChangeEvent<HTMLSelectElement>) {
    const newTo = e.target.value;
    const toIdx = periods.findIndex(p => p.id === newTo);
    const fromIdx = periods.findIndex(p => p.id === selectedFrom);
    // If new to is before current from, snap from to the same month
    const newFrom = fromIdx >= 0 && fromIdx > toIdx ? newTo : (selectedFrom ?? newTo);
    update(newFrom, newTo);
  }

  const selectClass = "appearance-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-2.5 pr-7 text-[12px] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none";

  return (
    <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
      <span>С</span>
      <div className="relative">
        <select value={selectedFrom ?? ''} onChange={handleFrom} className={selectClass}>
          {!selectedFrom && <option value="">—</option>}
          {periods.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
      </div>
      <span>по</span>
      <div className="relative">
        <select value={selectedTo ?? ''} onChange={handleTo} className={selectClass}>
          {!selectedTo && <option value="">—</option>}
          {periods.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
      </div>
      {(selectedFrom || selectedTo) && (
        <button
          onClick={() => update('', '')}
          className="text-[11px] text-[var(--text-4)] hover:text-[var(--danger)] transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}
