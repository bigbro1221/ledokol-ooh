'use client';

interface CityData {
  city: string;
  screens: number;
  ots: number;
}

function formatOts(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function CityBreakdown({ data }: { data: CityData[] }) {
  const maxOts = Math.max(...data.map(d => d.ots), 1);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight">Города</h3>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">Распределение поверхностей и OTS по городам</p>
      </div>

      {/* mobile: <640px — simplified list, no bar chart */}
      <div className="space-y-3 sm:hidden">
        {data.map(d => (
          <div key={d.city} className="flex flex-col gap-0.5 border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--text)]">{d.city}</span>
              <span className="text-[12px] text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {d.screens} экр.
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              OTS: {formatOts(d.ots)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: bar chart */}
      <div className="hidden space-y-2 sm:block">
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
              {formatOts(d.ots)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 hidden justify-end gap-6 text-[10px] uppercase tracking-wide text-[var(--text-4)] sm:flex">
        <span>Экранов</span>
        <span>OTS</span>
      </div>
    </div>
  );
}
