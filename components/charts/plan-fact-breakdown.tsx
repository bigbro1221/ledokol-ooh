'use client';

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('ru-RU');
}

function completionColor(pct: number | null): string {
  if (pct === null) return 'var(--text-4)';
  if (pct >= 100) return 'var(--success)';
  if (pct >= 80)  return 'var(--warning)';
  return 'var(--danger)';
}

interface Entry {
  label: string;
  plan: number;
  fact: number;
}

interface Props {
  title: string;
  subtitle?: string;
  data: Entry[];
  /** Value unit suffix for tooltip/legend — e.g. "OTS" */
  unit?: string;
}

export function PlanFactBreakdown({ title, subtitle, data, unit = 'OTS' }: Props) {
  if (data.length === 0) return null;

  const maxPlan = Math.max(...data.map(d => d.plan), 1);
  const anyFact = data.some(d => d.fact > 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--text-3)]">{subtitle}</p>}
        </div>
        {anyFact && (
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.06em] text-[var(--text-4)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-[var(--surface-3)]" />
              План
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-[var(--brand-primary)]" />
              Факт
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {data.map(row => {
          const pct = row.plan > 0 && row.fact > 0 ? (row.fact / row.plan) * 100 : null;
          const planWidth = (row.plan / maxPlan) * 100;
          const factWidth = (row.fact / maxPlan) * 100;
          const color = completionColor(pct);

          // Cap fact display at plan width so it never bleeds into numbers.
          // Over-delivery is communicated by the % number and color.
          const factDisplayWidth = Math.min(factWidth, planWidth);
          // Show a small overflow notch when fact > plan
          const overDelivery = row.fact > 0 && row.fact > row.plan;

          return (
            <div key={row.label} className="flex items-center gap-3">
              {/* Label */}
              <span className="w-20 shrink-0 truncate text-xs text-[var(--text-2)] sm:w-24">{row.label}</span>

              {/* Stacked bars — plan (track) + fact (fill) */}
              <div className="relative flex-1 overflow-hidden rounded-sm">
                {/* Plan bar — gray track, full proportional width */}
                <div
                  className="h-5 bg-[var(--surface-3)]"
                  style={{ width: `${planWidth}%`, minWidth: '2px' }}
                />
                {/* Fact bar overlay — capped at plan width */}
                {row.fact > 0 && (
                  <div
                    className="absolute left-0 top-0 h-5 transition-all duration-500"
                    style={{
                      width: `${factDisplayWidth}%`,
                      background: color,
                      opacity: 0.9,
                      // Over-delivery: sharp right edge + slight brightness boost
                      borderRadius: overDelivery ? '2px 0 0 2px' : '2px',
                    }}
                  />
                )}
                {/* Over-delivery marker — thin bright line at the plan-end */}
                {overDelivery && (
                  <div
                    className="absolute top-0 h-5 w-[3px]"
                    style={{ left: `calc(${planWidth}% - 3px)`, background: color, filter: 'brightness(1.4)' }}
                  />
                )}
              </div>

              {/* Numbers */}
              <div className="flex shrink-0 items-center gap-3 text-[11px]" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                <span className="w-14 text-right text-[var(--text-3)]">{fmt(row.plan)}</span>
                <span className="w-14 text-right" style={{ color: row.fact > 0 ? color : 'var(--text-4)' }}>
                  {row.fact > 0 ? fmt(row.fact) : '—'}
                </span>
                <span className="w-12 text-right text-[11px]" style={{ color }}>
                  {pct !== null ? `${pct.toFixed(0)}%` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Column headers */}
      <div className="mt-3 flex justify-end gap-3 pr-0 text-[10px] uppercase tracking-[0.06em] text-[var(--text-4)]" style={{ fontFamily: 'var(--font-mono)' }}>
        <span className="w-14 text-right">План {unit}</span>
        <span className="w-14 text-right">Факт</span>
        <span className="w-12 text-right">%</span>
      </div>
    </div>
  );
}
