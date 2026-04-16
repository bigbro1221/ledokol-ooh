'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const TYPE_OPTIONS = [
  { value: 'LED', label: 'LED' },
  { value: 'STATIC', label: 'Статика' },
  { value: 'STOP', label: 'Остановки' },
  { value: 'AIRPORT', label: 'Аэропорт' },
  { value: 'BUS', label: 'Транспорт' },
];

export function FilterBar({
  cities,
  locale,
}: {
  cities: string[];
  locale: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCity = searchParams.get('city') || '';
  const activeType = searchParams.get('type') || '';

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/${locale}/dashboard?${params.toString()}`);
  }, [router, searchParams, locale]);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {/* City filter */}
      <select
        value={activeCity}
        onChange={(e) => updateParam('city', e.target.value)}
        className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none"
      >
        <option value="">Все города</option>
        {cities.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Type filter pills */}
      <div className="flex gap-1">
        <button
          onClick={() => updateParam('type', '')}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
            !activeType ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)]' : 'bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)]'
          }`}
        >
          Все типы
        </button>
        {TYPE_OPTIONS.map(t => (
          <button
            key={t.value}
            onClick={() => updateParam('type', activeType === t.value ? '' : t.value)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              activeType === t.value ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)]' : 'bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Clear all */}
      {(activeCity || activeType) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('city');
            params.delete('type');
            router.push(`/${locale}/dashboard?${params.toString()}`);
          }}
          className="text-xs text-[var(--text-3)] hover:text-[var(--danger)]"
        >
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}
