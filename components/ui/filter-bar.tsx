'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';

const TYPE_VALUES = ['LED', 'STATIC', 'STOP', 'AIRPORT', 'BUS', 'ROOF', 'BRANDMAUER', 'CINEMA', 'METRO'] as const;

interface Period {
  id: string;
  name: string;
}

export function FilterBar({
  cities,
  availableTypes,
  periods,
  selectedPeriods,
  locale,
}: {
  cities: string[];
  availableTypes: string[];
  periods: Period[];
  selectedPeriods: string[];
  locale: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tf = useTranslations('filters');
  const tTypes = useTranslations('screenTypes');

  const activeCities = (searchParams.get('city') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const activeTypes = (searchParams.get('type') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const updateMulti = useCallback((key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length > 0) params.set(key, values.join(','));
    else params.delete(key);
    router.push(`/${locale}/dashboard?${params.toString()}`);
  }, [router, searchParams, locale]);

  const hasAny = activeCities.length > 0 || activeTypes.length > 0 || selectedPeriods.length > 0;

  const periodOptions = periods.map(p => ({ value: p.id, label: p.name }));
  const typeOptions = TYPE_VALUES
    .filter(t => availableTypes.includes(t))
    .map(t => ({ value: t, label: tTypes(t) }));
  const cityOptions = cities.map(c => ({ value: c, label: c }));

  function reset() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('city');
    params.delete('type');
    params.delete('periods');
    params.delete('periodFrom');
    params.delete('periodTo');
    router.push(`/${locale}/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {periods.length >= 2 && (
        <MultiSelectDropdown
          label={tf('periodLabel')}
          allLabel={tf('allPeriodsShort')}
          options={periodOptions}
          selected={selectedPeriods}
          onChange={(v) => updateMulti('periods', v)}
          width={240}
        />
      )}

      <MultiSelectDropdown
        label={tf('typeLabel')}
        allLabel={tf('allTypesShort')}
        options={typeOptions}
        selected={activeTypes}
        onChange={(v) => updateMulti('type', v)}
        width={240}
      />

      <MultiSelectDropdown
        label={tf('cityLabel')}
        allLabel={tf('allCitiesShort')}
        options={cityOptions}
        selected={activeCities}
        onChange={(v) => updateMulti('city', v)}
        width={240}
      />

      {hasAny && (
        <button
          type="button"
          onClick={reset}
          className="text-[12px] text-[var(--text-3)] transition-colors hover:text-[var(--danger)]"
        >
          {tf('reset')}
        </button>
      )}
    </div>
  );
}
