'use client';

interface CityData {
  city: string;
  screens: number;
  ots: number;
}

export function CityBreakdown({ data }: { data: CityData[] }) {
  const maxOts = Math.max(...data.map(d => d.ots), 1);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight">Города</h3>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">Распределение поверхностей и OTS по городам</p>
      </div>
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.city} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-[var(--text-2)]">{d.city}</span>
            <div className="flex-1">
              <div
                className="h-5 rounded-sm bg-[var(--chart-2)]"
                style={{ width: `${(d.ots / maxOts) * 100}%`, minWidth: '2px', opacity: 0.7 }}
              />
            </div>
            <span className="w-12 text-right text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {d.screens}
            </span>
            <span className="w-20 text-right text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {d.ots >= 1000000 ? `${(d.ots / 1000000).toFixed(1)}M` : d.ots >= 1000 ? `${(d.ots / 1000).toFixed(0)}k` : d.ots}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-6 text-[10px] uppercase tracking-wide text-[var(--text-4)]">
        <span>Экранов</span>
        <span>OTS</span>
      </div>
    </div>
  );
}
