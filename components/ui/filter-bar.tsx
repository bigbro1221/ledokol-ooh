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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* City filter — full width on mobile */}
      <select
        value={activeCity}
        onChange={(e) => updateParam('city', e.target.value)}
        className="w-full min-h-[44px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none sm:w-auto sm:min-h-0 sm:py-1.5 sm:text-xs"
      >
        <option value="">Все города</option>
        {cities.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Type filter pills — horizontal scroll on mobile */}
      <div className="filter-pills-scroll relative -mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex gap-1 min-w-max sm:min-w-0">
          <button
            onClick={() => updateParam('type', '')}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors sm:py-1 sm:text-[11px] ${
              !activeType ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)]' : 'bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)]'
            }`}
          >
            Все типы
          </button>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t.value}
              onClick={() => updateParam('type', activeType === t.value ? '' : t.value)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors sm:py-1 sm:text-[11px] ${
                activeType === t.value ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)]' : 'bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
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
          className="text-left text-xs text-[var(--text-3)] hover:text-[var(--danger)] sm:text-center"
        >
          Сбросить фильтры
        </button>
      )}

      {/* mobile: <640px — hide scrollbar, momentum scroll, fade on right edge */}
      <style jsx>{`
        .filter-pills-scroll {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .filter-pills-scroll::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 639px) {
          .filter-pills-scroll {
            mask-image: linear-gradient(to right, black 80%, transparent 100%);
            -webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%);
          }
        }
      `}</style>
    </div>
  );
}
